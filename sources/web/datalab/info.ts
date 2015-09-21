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

function stringifyMap(map: {[index: string]: string}): string {
  var textBuilder: string[] = [];

  var names: string[] = [];
  for (var n in map) {
    names.push(n);
  }
  names = names.sort();

  for (var i = 0; i < names.length; i++) {
    textBuilder.push(names[i] + ': ' + map[names[i]]);
  }

  return textBuilder.join('\n');
}

/**
 * Implements information request handling.
 * @param request the incoming health request.
 * @param response the outgoing health response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  response.writeHead(200, { 'Content-Type': 'text/plain' });

  response.write('Environment Variables:\n');
  response.write(stringifyMap(process.env));
  response.write('\n\n');

  response.write('Application Settings:\n');
  response.write(JSON.stringify(appSettings, null, 2));
  response.write('\n\n');

  response.write('Request Headers:\n');
  response.write(stringifyMap(request.headers));
  response.write('\n\n');

  response.write('Jupyter Servers:\n');
  response.write(JSON.stringify(jupyter.getInfo(), null, 2));
  response.write('\n\n');
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
