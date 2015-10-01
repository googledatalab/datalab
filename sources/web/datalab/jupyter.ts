/*
 * Copyright 2015 Google Inc. All rights reserved.
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

import analytics = require('./analytics');
import callbacks = require('./callbacks');
import childProcess = require('child_process');
import fs = require('fs');
import http = require('http');
import httpProxy = require('http-proxy');
import logging = require('./logging');
import net = require('net');
import path = require('path');
import tcp = require('tcp-port-used');
import url = require('url');
import userManager = require('./userManager');

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
 * Used to make sure no multiple initialization runs happen for the same user
 * at same time.
 */
var callbackManager: callbacks.CallbackManager = new callbacks.CallbackManager();

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

/**
 * Starts the Jupyter server, and then creates a proxy object enabling
 * routing HTTP and WebSocket requests to Jupyter.
 */
function createJupyterServer(userId: string): JupyterServer {
  var port = nextJupyterPort;
  nextJupyterPort++;

  var userDir = userManager.getUserDir(userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, parseInt('0755',8));
  }

  var server: JupyterServer = {
    userId: userId,
    port: port,
    notebooks: userDir
  };

  function exitHandler(code: number, signal: string): void {
    logging.getLogger().error('Jupyter process %d for user %s exited due to signal: %s',
                              server.childProcess.pid, userId, signal);
    delete jupyterServers[server.userId];
  }

  var processArgs = appSettings.jupyterArgs.slice().concat([
    '--port=' + server.port,
    '--notebook-dir="' + server.notebooks + '"'
  ]);

  var processOptions = {
    detached: false,
    env: process.env
  };

  server.childProcess = childProcess.spawn('jupyter', processArgs, processOptions);
  server.childProcess.on('exit', exitHandler);
  logging.getLogger().info('Jupyter process for user %s started with pid %d and args %j',
                           userId, server.childProcess.pid, processArgs);

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

export function getPort(request: http.ServerRequest): number {
  var userId = userManager.getUserId(request);
  var server = jupyterServers[userId];

  return server ? server.port : 0;
}

export function getInfo(): Array<common.Map<any>> {
  var info: Array<common.Map<any>> = [];
  for (var n in jupyterServers) {
    var jupyterServer = jupyterServers[n];

    var serverInfo: common.Map<any> = {
      userId: jupyterServer.userId,
      port: jupyterServer.port,
      notebooks: jupyterServer.notebooks,
      pid: jupyterServer.childProcess.pid
    };
    info.push(serverInfo);
  }

  return info;
}

/**
 * Starts a jupyter server instance for given user.
 */
export function startForUser(userId: string, cb: common.Callback0) {
  var server = jupyterServers[userId];
  if (server) {
    process.nextTick(function() { cb(null); });
    return;
  }

  if (!callbackManager.checkOngoingAndRegisterCallback(userId, cb)) {
    // There is already a start request ongoing. Return now to avoid multiple Jupyter
    // processes for the same user.
    return;
  }

  try {
    logging.getLogger().info('Starting jupyter server for %s.', userId);
    server = createJupyterServer(userId);
    if (server) {
      tcp.waitUntilUsed(server.port).then(
        function() {
          jupyterServers[userId] = server;
          logging.getLogger().info('Jupyter server started for %s.', userId);
          callbackManager.invokeAllCallbacks(userId, null);
        },
        function(e) {
          logging.getLogger().error(e, 'Failed to start Jupyter server for user %s.', userId);
          callbackManager.invokeAllCallbacks(userId, e);
        });
    }
    else {
      // Should never be here.
      logging.getLogger().error('Failed to start Jupyter server for user %s.', userId);
      callbackManager.invokeAllCallbacks(userId, new Error('failed to start jupyter server.'));
    }
  }
  catch (e) {
    logging.getLogger().error(e, 'Failed to start Jupyter server for user %s.', userId);
    callbackManager.invokeAllCallbacks(userId, e);
  }
}

/**
 * Initializes the Jupyter server manager.
 */
export function init(settings: common.Settings): void {
  appSettings = settings;
}

/**
 * Closes the Jupyter server manager.
 */
export function close(): void {
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
  var userId = userManager.getUserId(request);
  var server = jupyterServers[userId];
  if (!server) {
    // should never be here.
    logging.getLogger().error('Jupyter server was not created yet for user %s.', userId);
    response.statusCode = 500;
    response.end();
    return;
  }
  server.proxy.web(request, response);
}


function sendTemplate(key: string, data: common.Map<string>, response: http.ServerResponse) {
  var template = templates[key];

  // NOTE: Uncomment to use external templates mapped into the container.
  //       This is only useful when actively developing the templates themselves.
  // template = fs.readFileSync('/sources/datalab/templates/' + key + '.html', { encoding: 'utf8' });

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
      analyticsPath: analytics.hashPath(path, 'sha256'),
      projectNumber: appSettings.projectNumber,
      projectId: appSettings.projectId,
      versionId: appSettings.versionId,
      instanceId: appSettings.instanceId,
      instanceName: appSettings.instanceName,
      userId: userManager.getUserId(request),
      baseUrl: '/'
    };

    var page: string = null;
    if (path.indexOf('/tree') == 0) {
      // stripping off the /tree/ from the path
      templateData['notebookPath'] = path.substr(6);

      sendTemplate('tree', templateData, response);
      page = 'tree';
    }
    else {
      // stripping off the /notebooks/ from the path
      templateData['notebookPath'] = path.substr(11);
      templateData['notebookName'] = path.substr(path.lastIndexOf('/') + 1);

      sendTemplate('nb', templateData, response);
      page = 'notebook';
    }

    // Suppress further writing to the response to prevent sending response
    // from the notebook server. There is no way to communicate that, so hack around the
    // limitation, by stubbing out all the relevant methods on the response with
    // no-op methods.
    response.setHeader = placeHolder;
    response.writeHead = placeHolder;
    response.write = placeHolder;
    response.end = placeHolder;

    analytics.logPage(page, path, request.headers['x-appengine-user-id']);
  }
}

function errorHandler(error: Error, request: http.ServerRequest, response: http.ServerResponse) {
  logging.getLogger().error(error, 'Jupyter server returned error.')

  response.writeHead(500, 'Internal Server Error');
  response.end();
}

function placeHolder(): boolean { return false; }
