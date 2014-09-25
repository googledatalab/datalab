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

import common = require('./common');
import health = require('./health');
import http = require('http');
import httpProxy = require('http-proxy');
import ipython = require('./ipython');
import net = require('net');
import sockets = require('./sockets');
import url = require('url');

var ipythonServer: httpProxy.ProxyServer;
var socketRelay: sockets.SocketRelay;
var healthStatus: health.StatusProvider;

function requestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  var path = url.parse(request.url).pathname;

  // /_ah/* paths are completed handled in this server, and not forwarded on to
  // IPython as HTTP calls.
  if (path.indexOf('/_ah') == 0) {
    healthStatus(request, response);
    return;
  }

  // /socket/* paths are completed handled in this server, and not forwarded on to
  // IPython as HTTP calls.
  if (path.indexOf('/socket') == 0) {
    socketRelay(request, response);
    return;
  }

  ipythonServer.web(request, response);
}

function upgradeHandler(request: http.ServerRequest, socket: net.Socket, head: Buffer) {
  ipythonServer.ws(request, socket, head);
}

export function run(settings: common.Settings) {
  ipythonServer = ipython.createProxyServer(settings);
  socketRelay = sockets.createSocketRelay(settings);
  healthStatus = health.createStatusProvider(settings);

  var server = http.createServer(requestHandler);
  server.on('upgrade', upgradeHandler);

  console.log('Starting IPython proxy server at http://localhost:%d ...', settings.serverPort);
  server.listen(settings.serverPort, '0.0.0.0');
}
