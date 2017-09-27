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

/// <reference path="../../../third_party/externs/ts/node/node.d.ts" />
/// <reference path="../../../third_party/externs/ts/node/node-http-proxy.d.ts" />
/// <reference path="common.d.ts" />


import http = require('http');
import httpProxy = require('http-proxy');
import logging = require('./logging');
import url = require('url');

var appSettings: common.AppSettings;
var proxy: httpProxy.ProxyServer = httpProxy.createProxyServer(null);
var regex: any = new RegExp('\/_proxy\/([0-9]+)($|\/)');
var socketioPort: string = '';

function errorHandler(error: Error, request: http.ServerRequest, response: http.ServerResponse) {
  response.writeHead(500, 'Reverse Proxy Error.');
  response.end();
}

function getPort(url: string) {
  if (url) {
    var sr: any = regex.exec(url);
    if (sr) {
      return sr[1];
    }
  }
  return null;
}

/**
 * Returns true iff the request should be served by the reverse proxy.
 */
export function isReverseProxyRequest(request: http.ServerRequest) {
  var urlpath = url.parse(request.url, true).pathname;
  return !!getRequestPort(request, urlpath);
}

/**
 * Get port from request. If the request should be handled by reverse proxy, returns
 * the port as a string. Othewise, returns null.
 */
export function getRequestPort(request: http.ServerRequest, path: string): string {
  var port: string = getPort(path) || getPort(request.headers.referer);
  if (!port) {
    if (path.indexOf('/socket.io/') == 0) {
      port = socketioPort;
    }
  }
  return port;
}

/**
 * Handle request by sending it to the internal http endpoint.
 */
export function handleRequest(request: http.ServerRequest,
                              response: http.ServerResponse,
                              port: String) {
  request.url = request.url.replace(regex, '');
  let target = 'http://localhost:' + port;

  // Only web socket requests (through socket.io) need the basepath appended
  if (request.url.indexOf('/socket.io/') === 0) {
    target += appSettings.datalabBasePath;
  }
  proxy.web(request, response, {
    target
  });
}

/**
 * Initialize the handler.
 */
export function init(settings: common.AppSettings) {
  appSettings = settings;
  socketioPort = String(settings.socketioPort);
  proxy.on('error', errorHandler);
}

