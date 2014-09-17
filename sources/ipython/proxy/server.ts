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
/// <reference path="../../../externs/ts/node-http-proxy/node-http-proxy.d.ts" />

import http = require('http');
import httpProxy = require('http-proxy');
import net = require('net');

var proxyOptions : httpProxy.ProxyServerOptions = {
  target: 'http://localhost:8080'
};
var proxy = httpProxy.createProxyServer(proxyOptions);

function requestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  proxy.web(request, response);
}

function upgradeHandler(request: http.ServerRequest, socket: net.Socket, head: Buffer) {
  proxy.ws(request, socket, head);
}

var server = http.createServer(requestHandler);
server.on('upgrade', upgradeHandler);
server.listen(8000);
