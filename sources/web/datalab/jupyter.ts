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
/// <reference path="../../../externs/ts/node/tcp-port-used.d.ts" />
/// <reference path="common.d.ts" />

import childProcess = require('child_process');
import fs = require('fs');
import http = require('http');
import httpProxy = require('http-proxy');
import logging = require('./logging');
import net = require('net');
import path = require('path');
import tcp = require('tcp-port-used');
import url = require('url');

interface JupyterServer {
  userId: string;
  port: number;
  notebooks: string;
  childProcess?: childProcess.ChildProcess;
  proxy?: httpProxy.ProxyServer;
}

/**
 * Jupyter servers key'd by user id (each server is associated with a single user)
 */
var jupyterServers: common.Map<JupyterServer> = {};
var nextJupyterPort = 9000;

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

function pipeOutput(stream: NodeJS.ReadableStream, port: number, error: boolean) {
  stream.setEncoding('utf8');
  stream.on('data', (data: string) => {
    // Jupyter generates a polling kernel message once every 3 seconds
    // per kernel! This adds too much noise into the log, so avoid
    // logging it.

    if (data.indexOf('Polling kernel') < 0) {
      logging.logJupyterOutput('[' + port + ']: ' + data, error);
    }
  })
}

function getUserId(request: http.ServerRequest): string {
  return request.headers['x-appengine-user-email'] || appSettings.instanceUser || 'anonymous';
}

/**
 * Starts the Jupyter server, and then creates a proxy object enabling
 * routing HTTP and WebSocket requests to Jupyter.
 */
function createJupyterServer(userId: string): JupyterServer {
  var port = nextJupyterPort;
  nextJupyterPort++;

  // TODO: Implement per-user notebook directories
  var server: JupyterServer = {
    userId: userId,
    port: port,
    notebooks: '/content'
  };

  function exitHandler(code: number, signal: string): void {
    logging.getLogger().error('Jupyter process %d exited due to signal: %s',
                              server.childProcess.pid, signal);
    delete jupyterServers[server.userId];
  }

  var processArgs = [
    '--port=' + server.port,
    '--notebook-dir="' + server.notebooks + '"'
  ];

  processArgs = appSettings.jupyterArgs.slice().concat(processArgs);

  // TODO: Additional args that seem interesting to consider.
  // --KernelManager.autorestart=True

  var processOptions = {
    detached: false,
    env: process.env
  };

  server.childProcess = childProcess.spawn('jupyter', processArgs, processOptions);
  server.childProcess.on('exit', exitHandler);
  logging.getLogger().info('Jupyter process started with pid %d and args %j',
                           server.childProcess.pid, processArgs);

  // Capture the output, so it can be piped for logging.
  pipeOutput(server.childProcess.stdout, server.port, /* error */ false);
  pipeOutput(server.childProcess.stderr, server.port, /* error */ true);

  // Then create the proxy.
  var proxyOptions: httpProxy.ProxyServerOptions = {
    target: 'http://127.0.0.1:' + server.port
  };

  server.proxy = httpProxy.createProxyServer(proxyOptions);
  server.proxy.on('proxyRes', responseHandler);
  server.proxy.on('error', errorHandler);

  return server;
}

function getServer(request: http.ServerRequest, cb: common.Callback<JupyterServer>): void {
  var userId = getUserId(request);
  var server = jupyterServers[userId];

  if (!server) {
    try {
      server = createJupyterServer(userId);
      if (server) {
        tcp.waitUntilUsed(server.port).then(
           function() {
             jupyterServers[userId] = server;
             cb(null, server);
           },
           function(e) {
             cb(e, null);
           });
      }
    }
    catch (e) {
      cb(e, null);
    }
  }
  else {
    process.nextTick(function() {
      cb(null, server);
    });
  }
}

export function getPort(request: http.ServerRequest): number {
  var userId = getUserId(request);
  var server = jupyterServers[userId];

  return server ? server.port : 0;
}

export function getServers(): Array<common.Map<any>> {
  var servers: Array<common.Map<any>> = [];
  for (var n in jupyterServers) {
    var jupyterServer = jupyterServers[n];

    var server: common.Map<any> = {
      userId: jupyterServer.userId,
      port: jupyterServer.port,
      notebooks: jupyterServer.notebooks,
      pid: jupyterServer.childProcess.pid
    };
    servers.push(server);
  }

  return servers;
}

/**
 * Starts the Jupyter server manager.
 */
export function start(settings: common.Settings): void {
  appSettings = settings;
}

/**
 * Stops the Jupyter server manager.
 */
export function stop(): void {
  for (var n in jupyterServers) {
    var jupyterServer = jupyterServers[n];
    var jupyterProcess = jupyterServer.childProcess;

    try {
      jupyterProcess.kill('SIGHUP');
    }
    catch (e) {
    }
  }

  jupyterServers = {};
}

export function handleRequest(request: http.ServerRequest, response: http.ServerResponse) {
  getServer(request, function(e, server) {
    if (e) {
      logging.getLogger().error(e, 'Unable to get or start Jupyter server.');

      response.statusCode = 500;
      response.end();
    }
    else {
      server.proxy.web(request, response);
    }
  });
}


function sendTemplate(key: string, data: common.Map<string>, response: http.ServerResponse) {
  var template = templates[key];

  // NOTE: Uncomment to use external templates mapped into the container.
  //       This is only useful when actively developing the templates themselves.
  // var template = fs.readFileSync('/nb/sources/' + key + '.html', { encoding: 'utf8' });

  // Replace <%name%> placeholders with actual values.
  // TODO: Error handling if template placeholders are out-of-sync with
  //       keys in passed in data object.
  var htmlContent = template.replace(/\<\%(\w+)\%\>/g, function(match, name) {
    return data[name];
  });

  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end(htmlContent);
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
      feedbackId: appSettings.feedbackId,
      analyticsId: appSettings.analyticsId,
      projectNumber: appSettings.projectNumber,
      projectId: appSettings.projectId,
      versionId: appSettings.versionId,
      instanceId: appSettings.instanceId,
      userHash: request.headers['x-appengine-user-id'] || '0',
      userId: getUserId(request),
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

function placeHolder(): boolean { return false; }
