/*
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */

/// <reference path="../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../externs/ts/node/node-http-proxy.d.ts" />
/// <reference path="common.d.ts" />

import childProcess = require('child_process');
import fs = require('fs');
import http = require('http');
import httpProxy = require('http-proxy');
import logging = require('./logging');
import path = require('path');
import url = require('url');

/**
 * Templates
 */
var templates: common.Map<string> = {
  'tree': fs.readFileSync(path.join(__dirname, 'templates', 'tree.html'), { encoding: 'utf8' }),
  'nb': fs.readFileSync(path.join(__dirname, 'templates', 'nb.html'), { encoding: 'utf8' })
};

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

/**
 * The Jupyter notebook server process.
 */
var jupyterProcess: childProcess.ChildProcess;

function placeHolder(): boolean { return false; }

function formatTemplate(htmlTemplate: string, data: common.Map<string>): string {
  // Replace <%name%> placeholders with actual values.
  // TODO: Error handling if template placeholders are out-of-sync with
  //       keys in passed in data object.

  return htmlTemplate.replace(/\<\%(\w+)\%\>/g, function(match, name) {
    return data[name];
  });
}

function sendTemplate(key: string, data: common.Map<string>, response: http.ServerResponse) {
  var template = templates[key];

  // NOTE: Uncomment to use external templates mapped into the container.
  //       This is only useful when actively developing the templates themselves.
  // var template = fs.readFileSync('/nb/sources/' + key + '.html', { encoding: 'utf8' });

  var htmlContent = formatTemplate(templates[key], data);

  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end(htmlContent);
}

function pipeOutput(stream: NodeJS.ReadableStream, error: boolean) {
  stream.setEncoding('utf8');
  stream.on('data', (data: string) => {
    // Jupyter generates a polling kernel message once every 3 seconds
    // per kernel! This adds too much noise into the log, so avoid
    // logging it.

    if (data.indexOf('Polling kernel') < 0) {
      logging.logJupyterOutput(data, error);
    }
  })
}

function exitHandler(code: number, signal: string): void {
  logging.getLogger().error('Jupyter process %d exited due to signal: %s',
                            jupyterProcess.pid, signal);
  process.exit();
}


function responseHandler(proxyResponse: http.ClientResponse,
                         request: http.ServerRequest, response: http.ServerResponse) {
  if (proxyResponse.headers['access-control-allow-origin'] !== undefined) {
    // Delete the allow-origin = * header that is sent (likely as a result of a workaround
    // notebook configuration to allow server-side websocket connections that are
    // interpreted by Jupyter as cross-domain).
    delete proxyResponse.headers['access-control-allow-origin'];
  }

  if (proxyResponse.statusCode != 200) {
    return;
  }

  // Set a cookie to provide information about the project and authenticated user to the client.
  // Ensure this happens only for page requests, rather than for API requests.
  var path = url.parse(request.url).pathname;
  if ((path.indexOf('/tree') == 0) || (path.indexOf('/notebooks') == 0)) {
    var templateData: common.Map<string> = {
      analyticsId: appSettings.analyticsId,
      projectNumber: appSettings.projectNumber,
      projectId: appSettings.projectId,
      versionId: appSettings.versionId,
      instanceId: appSettings.instanceId,
      userHash: request.headers['x-appengine-user-id'] || '0',
      userId: request.headers['x-appengine-user-email'] || appSettings.instanceUser || '',
      baseUrl: '/'
    };

    if (path.indexOf('/tree') == 0) {
      // stripping off the /tree/ from the path
      templateData['notebookPath'] = path.substr(6);

      sendTemplate('tree', templateData, response);
    }
    else {
      // stripping off the /notebooks/ from the path
      templateData['notebookPath'] = path.substr(11);
      templateData['notebookName'] = path.substr(path.lastIndexOf('/') + 1);

      sendTemplate('nb', templateData, response);
    }

    // Suppress further writing to the response to prevent sending response
    // from the notebook server. There is no way to communicate that, so hack around the
    // limitation, by stubbing out all the relevant methods on the response with
    // no-op methods.
    response.setHeader = placeHolder;
    response.writeHead = placeHolder;
    response.write = placeHolder;
    response.end = placeHolder;
  }
}

function errorHandler(error: Error, request: http.ServerRequest, response: http.ServerResponse) {
  logging.getLogger().error(error, 'Jupyter server returned error.')

  response.writeHead(500, 'Internal Server Error');
  response.end();
}

/**
 * Starts the Jupyter server, and then creates a proxy object enabling
 * routing HTTP and WebSocket requests to Jupyter.
 * @param settings the configuration settings to use.
 * @returns the proxy representing the Jupyter server.
 */
export function createProxyServer(settings: common.Settings): httpProxy.ProxyServer {
  appSettings = settings;

  var jupyterArgs = appSettings.jupyterArgs;
  jupyterArgs.push('--port=' + appSettings.jupyterPort);

  // TODO: Additional args that seem interesting to consider.
  // --KernelManager.autorestart=True

  var processOptions = {
    detached: false,
    env: process.env
  };

  jupyterProcess = childProcess.spawn('jupyter', jupyterArgs, processOptions);
  jupyterProcess.on('exit', exitHandler);
  logging.getLogger().info('Jupyter process started with pid %d and args %j',
                           jupyterProcess.pid, jupyterArgs);

  // Capture the output, so it can be piped for logging.
  pipeOutput(jupyterProcess.stdout, /* error */ false);
  pipeOutput(jupyterProcess.stderr, /* error */ true);

  // Then create the proxy.
  var proxyOptions: httpProxy.ProxyServerOptions = {
    target: settings.jupyterWebServer
  };
  var proxy = httpProxy.createProxyServer(proxyOptions);
  proxy.on('proxyRes', responseHandler);
  proxy.on('error', errorHandler);

  return proxy;
}

/**
 * Stops the Jupyter server.
 */
export function stop(): void {
  // Ordinarily, the Jupyter server, being a child process, would automatically
  // be ended when this process ends - however Jupyter's behavior to prompt for confirmation
  // on exit requires more drastic and forced killing.

  if (jupyterProcess) {
    // Two consecutive kill signals to deal with the confirmation prompt
    // (apparently with a slight delay in between).
    jupyterProcess.kill('SIGHUP');

    setTimeout(function() {
      jupyterProcess.kill('SIGHUP');
      jupyterProcess = null;
    }, 100);
  }
}
