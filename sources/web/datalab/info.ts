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

import fs = require('fs');
import http = require('http');
import jupyter = require('./jupyter');
import url = require('url');

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

/**
 * Read one of the 'human readable' files from '/proc' and parse it.
 *
 * This assumes that the given 'filename' refers to one of the files under
 * the '/proc' directory that is meant to be in human readable format. Those
 * files are formatted as a newline-separated list of key-value pairs (with
 * the keys and values separated by a ':').
 *
 * Since these files are already formatted in a manner that is very similar
 * to a JSON dictionary, they are trivial to convert to JSON for use in the
 * '/_info' API.
 *
 * @param filename the fully qualified name of the file to read.
 */
function readProcFile(filename: string): any {
  var obj: any = {};
  try {
    var contents: string = fs.readFileSync(filename, { encoding: 'utf8' });
    var lines: Array<string> = contents.split('\n');
    for (var l in lines) {
      var line: string = lines[l];
      var lineParts: Array<string> = line.split(":");
      if (lineParts.length >= 2) {
        obj[lineParts[0].trim()] = lineParts[1].trim();
      }
    }
    var lines: Array<string> = contents.split('\n');
  } catch (e) {
    return e.message;
  }
  return obj;
}

/**
 * Implements information request handling.
 * @param request the incoming health request.
 * @param response the outgoing health response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  var info: any = {};
  info['env'] = process.env;
  info['mem'] = readProcFile('/proc/meminfo');
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
