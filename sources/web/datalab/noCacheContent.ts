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
/// <reference path="../../../third_party/externs/ts/node/node-http-proxy.d.ts" />
/// <reference path="common.d.ts" />

import fs = require('fs');
import http = require('http');
import path = require('path');

var appSettings: common.AppSettings;

/**
 * Initializes settings for the noCacheContent handler.
 */
export function init(settings: common.AppSettings): void {
  appSettings = settings;
}

function noCacheDir(): string {
  return path.join(appSettings.datalabRoot, '/datalab/nocachecontent')
}

function getContent(filePath: string, cb: common.Callback<Buffer>): void {
  fs.readFile(filePath, function(error, content) {
    if (error) {
      console.log(error);
      cb(error, null);
    }
    else {
      cb(null, content);
    }
  });
}

/**
 * Sends a nocache file as the response.
 * @param fileName the name of the file to send.
 * @param response the out-going response associated with the current HTTP request.
 */
function sendFile(fileName: string, response: http.ServerResponse) {
  if (fileName.indexOf('/') >= 0) {
    // We should not take request that goes out of noCacheDir.
    response.writeHead(400);
    response.end();
  }
  var filePath: string = path.join(noCacheDir(), fileName)
  getContent(filePath, function(error, content) {
    if (error) {
      response.writeHead(404);
      response.end();
    }
    else {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end(content);
    }
  });
}

/**
 * Implements no-cache content file handling.
 * @param path the request path.
 * @param response the outgoing file response.
 */
export function handleRequest(path: string, response: http.ServerResponse): void {
  if (path.indexOf('/_nocachecontent/') == 0) {
    sendFile(path.substr(17), response);
  }
  else {
    // Should never be here.
    response.writeHead(400);
    response.end();
  }
}
