/*
 * Copyright 2016 Google Inc. All rights reserved.
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


/**
 * This file defines a simple web server that does three things:
 *   1. Serve static files if the request path matches /_nocachecontent/*.
 *   2. Reverse proxy the request if the request path is like /_proxy/1234.
 *   3. For everything else, send it to Jupyter Kernel Gateway server, assuming it is already
 *      started at 127.0.0.1:8081.
 *
 * This is used on Jupyter Kernel Gateway container where the frontend is served by Datalab web
 * server.
 */


/// <reference path="../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../externs/ts/node/node-http-proxy.d.ts" />
/// <reference path="../../../externs/ts/request/request.d.ts" />


import http = require('http');
import httpProxy = require('http-proxy');
import net = require('net');
import noCacheContent = require('../datalab/noCacheContent')
import url = require('url');

var proxy: httpProxy.ProxyServer = httpProxy.createProxyServer({ target: 'http://127.0.0.1:8081' });
var regex: any = new RegExp('\/_proxy\/([0-9]+)($|\/)');
var server: http.Server;

function getPort(path: string) {
  if (path) {
    var sr: any = regex.exec(path);
    if (sr) {
      return sr[1];
    }
  }
  return null;
}

function getRequestPort(request: http.ServerRequest, path: string): string {
  var port: string = getPort(path) || getPort(request.headers.referer);
  return port;
}

function requestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  var path: string = url.parse(request.url).pathname;
  if (path.indexOf('/_nocachecontent/') == 0) {
    noCacheContent.handleRequest(path, response);
    return;
  }
  var port: string = getRequestPort(request, path);
  if (port) {
    // A proxy request such as "/_proxy/1234". Send to the target port.
    request.url = request.url.replace(regex, '/');
    proxy.web(request, response, { target: 'http://127.0.0.1:' + port });
  }
  else {
    // A regular request. Send it over to kernal gateway server.
    proxy.web(request, response, null);
  }
}

function socketHandler(request: http.ServerRequest, socket: net.Socket, head: Buffer) {
  proxy.ws(request, socket, head);
}

function errorHandler(error: Error, request: http.ServerRequest, response: http.ServerResponse) {
  console.log(error);
  if (response) {
    response.writeHead(500, 'Internal Server Error');
    response.end();
  }
}

function exit() {
  server.close();
}

function err() {
  process.exit(1);
}

// Set up error handlers.
proxy.on('error', errorHandler);
process.on('uncaughtException', err);
process.on('SIGINT', err);
process.on('exit', exit);

// Start the server.
server = http.createServer(requestHandler);
server.on('upgrade', socketHandler);
server.listen(8080);
console.log('Kernel Gateway proxy started.');
