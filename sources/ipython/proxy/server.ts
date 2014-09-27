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

import fs = require('fs');
import health = require('./health');
import http = require('http');
import httpProxy = require('http-proxy');
import info = require('./info');
import ipython = require('./ipython');
import net = require('net');
import sockets = require('./sockets');
import url = require('url');

var ipythonServer: httpProxy.ProxyServer;
var socketHandler: http.RequestHandler;
var healthHandler: http.RequestHandler;
var infoHandler: http.RequestHandler;

/**
 * Sends a static file as the response.
 * @param path the path of the file to send.
 * @param contentType the associated mime type of the file.
 * @param response the out-going response associated with the current HTTP request.
 */
function sendFile(path: string, contentType: string, response: http.ServerResponse) {
 fs.readFile(path, function(error, content) {
   if (error) {
     response.writeHead(500);
   }
   else {
     response.writeHead(200, { 'Content-Type': contentType });
     response.end(content);
   }
 });
}

/**
 * Handles all requests sent to the proxy web server. Most requests are proxied to
 * the IPython web server, but some are filtered out, and handled completely here.
 * @param request the incoming HTTP request.
 * @param response the out-going HTTP response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  var path = url.parse(request.url).pathname;

  // /_ah/* paths are completed handled in this server, and not forwarded on to
  // IPython as HTTP calls.
  if (path.indexOf('/_ah') == 0) {
    healthHandler(request, response);
    return;
  }

  // /socket/* paths are completed handled in this server, and not forwarded on to
  // IPython as HTTP calls.
  if (path.indexOf('/socket') == 0) {
    socketHandler(request, response);
    return;
  }

  // Specific resources that are handled in the proxy
  if (path == '/static/base/images/favicon.ico') {
    sendFile('./static/favicon.ico', 'image/x-icon', response);
    return;
  }
  else if (path == '/static/base/images/ipynblogo.png') {
    sendFile('./static/brand.png', 'image/png', response);
    return;
  }

  if (path.indexOf('/_info') == 0) {
    infoHandler(request, response);
    return;
  }

  // Proxy the rest of the requests to IPython, and let it generate the response,
  // that is sent unmodified.
  ipythonServer.web(request, response);
}

/**
 * Handles Upgrade requests to initiate web sockets. This will only be called on
 * servers and environments where websockets are supported.
 * @param request the incoming HTTP request.
 * @param socket the socket associated with the request.
 * @param head the initial data on the request.
 */
function upgradeHandler(request: http.ServerRequest, socket: net.Socket, head: Buffer) {
  ipythonServer.ws(request, socket, head);
}

/**
 * Runs the proxy web server.
 * @param settings the configuration settings to use.
 */
export function run(settings: common.Settings): void {
  ipythonServer = ipython.createProxyServer(settings);

  socketHandler = sockets.createHandler(settings);
  healthHandler = health.createHandler(settings);
  infoHandler = info.createHandler(settings);

  var server = http.createServer(requestHandler);
  server.on('upgrade', upgradeHandler);

  console.log('Starting IPython proxy server at http://localhost:%d ...', settings.serverPort);
  server.listen(settings.serverPort, '0.0.0.0');
}
