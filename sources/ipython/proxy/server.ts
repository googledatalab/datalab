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
import logging = require('./logging');
import net = require('net');
import path = require('path');
import sockets = require('./sockets');
import url = require('url');

var server: http.Server;
var ipythonServer: httpProxy.ProxyServer;
var healthHandler: http.RequestHandler;
var infoHandler: http.RequestHandler;

/**
 * Sends a static file as the response.
 * @param fileName the name of the static file to send.
 * @param contentType the associated mime type of the file.
 * @param response the out-going response associated with the current HTTP request.
 */
function sendFile(fileName: string, contentType: string, response: http.ServerResponse) {
  var filePath = path.join(__dirname, 'static', fileName);
  fs.readFile(filePath, function(error, content) {
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
  logging.logRequest(request, response);

  var path = url.parse(request.url).pathname;

  // /_ah/* paths are completed handled in this server, and not forwarded on to
  // IPython as HTTP calls.
  if (path.indexOf('/_ah') == 0) {
    healthHandler(request, response);
    return;
  }

  // /ping is completely handled in this server, and not forwarded to IPython.
  // This call is issued to check for the existence of the application during
  // the deployment process.
  if (path.indexOf('/ping') == 0) {
    response.writeHead(200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });
    response.end("OK");

    return;
  }

  // Specific resources that are handled in the proxy
  if (path == '/') {
    response.statusCode = 302;
    response.setHeader('Location', '/tree');
    response.end();
    return;
  }
  else if (path == '/static/base/images/favicon.ico') {
    sendFile('favicon.ico', 'image/x-icon', response);
    return;
  }
  else if (path == '/static/base/images/ipynblogo.png') {
    sendFile('brand.png', 'image/png', response);
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
 * Runs the proxy web server.
 * @param settings the configuration settings to use.
 */
export function run(settings: common.Settings): void {
  ipythonServer = ipython.createProxyServer(settings);

  healthHandler = health.createHandler(settings);
  infoHandler = info.createHandler(settings);

  server = http.createServer(requestHandler);
  sockets.wrapServer(server, settings);

  logging.getLogger().info('Starting IPython proxy server at http://localhost:%d',
                           settings.serverPort);
  server.listen(settings.serverPort);
}

/**
 * Stops the server and associated IPython server.
 */
export function stop(): void {
  ipython.stop();
}
