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

/// <reference path="../../../externs/ts/node/node.d.ts" />
/// <reference path="common.d.ts" />

import http = require('http');
import jupyter = require('./jupyter');
import url = require('url');

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

/**
 * Implements information request handling.
 * @param request the incoming health request.
 * @param response the outgoing health response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  var info: any = {};
  info['env'] = process.env;
  info['requestHeaders'] = request.headers;
  info['settings'] = appSettings;
  info['servers'] = jupyter.getInfo();

  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.write(JSON.stringify(info, null, 2));
  response.end();
}

/**
 * Creates the information provider request handler.
 * @param settings configuration settings for the application.
 * @returns the request handler to handle information requests.
 */
export function createHandler(settings: common.Settings): http.RequestHandler {
  appSettings = settings;
  return requestHandler;
}
