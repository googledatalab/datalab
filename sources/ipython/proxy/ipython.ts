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

import http = require('http');
import httpProxy = require('http-proxy');

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

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
    appSettings.metadata.projectId,
    appSettings.metadata.versionId,
    appSettings.metadata.instanceId,
    request.headers['x-appengine-user-email'] || '---'
  ];
  proxyResponse.headers['set-cookie'] = 'gcp=' + cookieData.join(':');
}

function errorHandler(error: Error, request: http.ServerRequest, response: http.ServerResponse) {
  console.log(error.toString());

  response.writeHead(500, 'Internal Server Error');
  response.end();
}

/**
 * Creates a proxy object enabling routing HTTP and WebSocket requests to IPython.
 * @param settings the configuration settings to use.
 * @returns the proxy representing the IPython server.
 */
export function createProxyServer(settings: common.Settings): httpProxy.ProxyServer {
  appSettings = settings;

  var proxyOptions: httpProxy.ProxyServerOptions = {
    target: settings.ipythonWebServer
  };
  var proxy = httpProxy.createProxyServer(proxyOptions);
  proxy.on('proxyRes', responseHandler);
  proxy.on('error', errorHandler);

  return proxy;
}
