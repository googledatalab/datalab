/*
 * Copyright 2017 Google Inc. All rights reserved.
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
import fs = require('fs');
import path = require('path');
import logging = require('./logging');

var appSettings: common.Settings;
var fileIndex: string[] = [];

/**
 * Implements the file search/filter request handling.
 * @param request the incoming search request.
 * @param response the outgoing search response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  var parsedUrl = url.parse(request.url, true);
  var pattern = parsedUrl.query['pattern'];  

  var results = filter(pattern);

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.write(JSON.stringify(results));
  response.end();
}

/**
 * Builds an index of all files in the content directory to make search faster
 */
export function indexFiles(): void {
  var prefix = appSettings.contentDir + '/';
  var startTime = process.hrtime();
  index(appSettings.contentDir + '/');
  var indexTime = process.hrtime(startTime);
  logging.getLogger().info('Indexed ' + fileIndex.length + ' files in ' + indexTime[0] + ' seconds');
}

/**
 * Recursively indexes all files under the given search path into the global fileIndex object
 * @param searchpath the path prefix to start indexing
 */
function index(searchpath: string): void {
  if (!fs.existsSync(searchpath)) {
    return;
  }
  // stop the search if we've reached 1000,000 files
  if (fileIndex.length >= 1000000) {
    return;
  }
  fs.readdirSync(searchpath).forEach((file) => {
    // ignore hidden files/dirs
    if (file[0] === '.')
      return;

    var filename = path.join(searchpath, file);
    var stat = fs.lstatSync(filename);
    if (stat.isDirectory()) {
      index(filename);
    } else {
      fileIndex.push(filename.substr(appSettings.contentDir.length + 1));
    }
  });
}

/**
 * Filters the file index based on the provided pattern
 * @param pattern the search pattern
 * @returns a list of 20 matches that are superstrings of pattern
 */
function filter(pattern: string): string[] {
  pattern = pattern.toLowerCase();
  return fileIndex.filter((item) => {
    return item.toLowerCase().indexOf(pattern) > -1;
  }).slice(0, 20);
}

/**
 * Creates the file search/filter request handler.
 * @returns the request handler to handle search requests.
 */
export function createHandler(settings: common.Settings): http.RequestHandler {
  appSettings = settings;
  indexFiles();

  return requestHandler;
}
