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

/// <reference path="../../../third_party/externs/ts/node/node.d.ts" />
/// <reference path="common.d.ts" />

import http = require('http');
import url = require('url');

/**
 * Implements the Managed VM application health request handling.
 * @param request the incoming health request.
 * @param response the outgoing health response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  var requestUrl = url.parse(request.url);
  var path = requestUrl.pathname;

  if (path == '/_ah/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ok');
  }
  else if (path == '/_ah/start') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ok');
  }
  else if (path == '/_ah/stop') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ok');
    process.exit();
  }
  else {
    response.writeHead(404, 'Not Found', { 'Content-Type': 'text/plain' });
    response.end();
  }
}

/**
 * Creates the health status request handler.
 * @param settings configuration settings for the application.
 * @returns the request handler to handle health requests.
 */
export function createHandler(settings: common.AppSettings): http.RequestHandler {
  return requestHandler;
}
