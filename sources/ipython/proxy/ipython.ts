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
import http = require('http');
import httpProxy = require('http-proxy');
import logging = require('./logging');
import path = require('path');

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

/**
 * The ipython notebook server process.
 */
var ipythonProcess: childProcess.ChildProcess;


function pipeOutput(stream: NodeJS.ReadableStream, error: boolean) {
  stream.setEncoding('utf8');
  stream.on('data', (data: string) => {
    // IPython generates a polling kernel message once every 3 seconds
    // per kernel! This adds too much noise into the log, so avoid
    // logging it.

    if (data.indexOf('Polling kernel') < 0) {
      logging.logIPythonOutput(data, error);
    }
  })
}

function exitHandler(code: number, signal: string): void {
  logging.getLogger().error('IPython process %d exited due to signal: %s',
                            ipythonProcess.pid, signal);
  process.exit();
}


function responseHandler(proxyResponse: http.ClientResponse,
                         request: http.ServerRequest, response: http.ServerResponse) {
  if (proxyResponse.headers['access-control-allow-origin'] !== undefined) {
    // Delete the allow-origin = * header that is sent (likely as a result of a workaround
    // notebook configuration to allow server-side websocket connections that are
    // interpreted by IPython as cross-domain).
    delete proxyResponse.headers['access-control-allow-origin'];
  }

  // Set a cookie to provide information about the project and authenticated user to the client.
  // Create a cookie that stays valid for 5 minutes, and is marked as HTTP-only.
  var cookieData = [
    appSettings.analyticsId,
    appSettings.projectId,
    appSettings.versionId,
    appSettings.instanceId,
    request.headers['x-appengine-user-email'] || '---'
  ];
  proxyResponse.headers['set-cookie'] = 'gcp=' + cookieData.join(':');
}

function errorHandler(error: Error, request: http.ServerRequest, response: http.ServerResponse) {
  logging.getLogger().error(error, 'IPython server returned error.')

  response.writeHead(500, 'Internal Server Error');
  response.end();
}

/**
 * Starts the IPython notebook server, and then creates a proxy object enabling
 * routing HTTP and WebSocket requests to IPython.
 * @param settings the configuration settings to use.
 * @returns the proxy representing the IPython server.
 */
export function createProxyServer(settings: common.Settings): httpProxy.ProxyServer {
  appSettings = settings;

  // Start python, passing in a stub python script that launches IPython.
  // The python script is passed in all the IPython command-line arguments.
  var ipythonArgs = appSettings.ipythonArgs;
  ipythonArgs.push('--port=' + appSettings.ipythonPort);
  ipythonArgs.push('--config=' + path.join(__dirname, '..', 'config.py'));

  var pythonScript = path.join(__dirname, "config", "ipynb.py");
  var pythonArgs = [ pythonScript ].concat(ipythonArgs);
  var pythonOptions = {
    detached: false,
    env: process.env
  };

  ipythonProcess = childProcess.spawn('python', pythonArgs, pythonOptions);
  ipythonProcess.on('exit', exitHandler);
  logging.getLogger().info('IPython process started with pid %d', ipythonProcess.pid);

  // Capture the output, so it can be piped for logging.
  pipeOutput(ipythonProcess.stdout, /* error */ false);
  pipeOutput(ipythonProcess.stderr, /* error */ true);

  // Then create the proxy.
  var proxyOptions: httpProxy.ProxyServerOptions = {
    target: settings.ipythonWebServer
  };
  var proxy = httpProxy.createProxyServer(proxyOptions);
  proxy.on('proxyRes', responseHandler);
  proxy.on('error', errorHandler);

  return proxy;
}

/**
 * Stops the IPython notebook server.
 */
export function stop(): void {
  // Ordinarily, the IPython server, being a child process, would automatically
  // be ended when this process ends - however IPython's behavior to prompt for confirmation
  // on exit requires more drastic and forced killing.

  if (ipythonProcess) {
    // Two consecutive kill signals to deal with the confirmation prompt
    // (apparently with a slight delay in between).
    ipythonProcess.kill('SIGHUP');

    setTimeout(function() {
      ipythonProcess.kill('SIGHUP');
      ipythonProcess = null;
    }, 100);
  }
}
