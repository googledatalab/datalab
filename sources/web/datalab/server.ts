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
import jupyter = require('./jupyter');
import logging = require('./logging');
import net = require('net');
import path = require('path');
import sockets = require('./sockets');
import static = require('./static');
import url = require('url');

var server: http.Server;
var proxyServer: httpProxy.ProxyServer;
var healthHandler: http.RequestHandler;
var infoHandler: http.RequestHandler;
var staticHandler: http.RequestHandler;

/**
 * Handles all requests sent to the proxy web server. Some requests are handled within
 * the server, while some are proxied to the Jupyter notebook server.
 * @param request the incoming HTTP request.
 * @param response the out-going HTTP response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  var path = url.parse(request.url).pathname;

  // /_ah/* paths implement the AppEngine health check.
  if (path.indexOf('/_ah') == 0) {
    healthHandler(request, response);
    return;
  }

  // TODO(jupyter): Additional custom path - should go away eventually with replaced
  // pages.
  // /static and /custom paths for returning static content
  if ((path.indexOf('/static') == 0) || (path.indexOf('/custom') == 0)) {
    staticHandler(request, response);
    return;
  }

  // /ping allows the deployer to validate existence.
  if (path.indexOf('/ping') == 0) {
    // TODO: Remove support for CORS once the existence checks move to the deployment server.
    response.writeHead(200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    response.end("OK");
    return;
  }

  // All requests below are logged, while the ones above aren't, to avoid generating noise
  // into the log.
  logging.logRequest(request, response);

  // Landing page redirects to /tree to be able to use the Jupyter file list as
  // the initial page.
  if (path == '/') {
    response.statusCode = 302;
    response.setHeader('Location', '/tree');
    response.end();
    return;
  }

  // Requests proxied to Jupyter
  if ((path.indexOf('/api') == 0) ||
      (path.indexOf('/tree') == 0) ||
      (path.indexOf('/notebooks') == 0) ||
      (path.indexOf('/nbconvert') == 0) ||
      (path.indexOf('/files') == 0)) {
    proxyServer.web(request, response);
    return;
  }

  // /_info displays information about the server for diagnostics.
  if (path.indexOf('/_info') == 0) {
    infoHandler(request, response);
    return;
  }

  // Not Found
  response.statusCode = 404;
  response.end();
}

/**
 * Handles Upgrade requests to initiate web sockets. This will only be called on
 * servers and environments where websockets are supported.
 * @param request the incoming HTTP request.
 * @param socket the socket associated with the request.
 * @param head the initial data on the request.
 */
function upgradeHandler(request: http.ServerRequest, socket: net.Socket, head: Buffer) {
  proxyServer.ws(request, socket, head);
}

/**
 * Runs the proxy web server.
 * @param settings the configuration settings to use.
 */
export function run(settings: common.Settings): void {
  proxyServer = jupyter.createProxyServer(settings);

  healthHandler = health.createHandler(settings);
  infoHandler = info.createHandler(settings);
  staticHandler = static.createHandler(settings);

  server = http.createServer(requestHandler);

  // NOTE: Uncomment to enable native web sockets.
  // server.on('upgrade', upgradeHandler);

  // NOTE: This adds support for socket.io instead.
  sockets.wrapServer(server, settings);

  logging.getLogger().info('Starting DataLab server at http://localhost:%d',
                           settings.serverPort);
  server.listen(settings.serverPort);
}

/**
 * Stops the server and associated Jupyter server.
 */
export function stop(): void {
  jupyter.stop();
}
