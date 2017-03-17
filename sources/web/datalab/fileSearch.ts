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
/// <reference path="../../../third_party/externs/ts/fuzzy/fuzzy.d.ts" />
/// <reference path="common.d.ts" />

import http = require('http');
import url = require('url');
import fs = require('fs');
import path = require('path');
import querystring = require('querystring');
import userManager = require('./userManager');
import fuzzy = require('fuzzy');

/**
 * Implements the file search/filter request handling.
 * @param request the incoming search request.
 * @param response the outgoing search response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  var parsedUrl = url.parse(request.url, true);
  var prefix = parsedUrl.query['prefix'];  
  var pattern = parsedUrl.query['pattern'];

  var files: string[] = [];
  var userId = userManager.getUserId(request);
  var searchPath = userManager.getUserDir(userId) + '/' + prefix;

  search(searchPath, files);
  var ranked = rank(pattern, files, 10);
  var files_only = ranked.map(f => {return f.original});

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.write(JSON.stringify(files_only));
  response.end();
}

function search(searchpath: string, output: string[]): void {
  if (!fs.existsSync(searchpath)) {
    console.log('Path search start with ' + searchpath + ' returned no results.');
    return;
  }
  var files = fs.readdirSync(searchpath);
  for (var i = 0; i < files.length; i++) {
    // ignore hidden files/dirs
    if (files[i][0] === '.')
      continue;

    var filename = path.join(searchpath, files[i]);
    var stat = fs.lstatSync(filename);
    if (stat.isDirectory()) {
      search(filename, output);
    } else {
      output.push(filename);
    }
  }
}

function rank(pattern: string, files: string[], topk: number): fuzzy.result[] {
  var results = fuzzy.filter(pattern, files);
  return results.slice(0, topk);
}

/**
 * Creates the file search/filter request handler.
 * @returns the request handler to handle search requests.
 */
export function createHandler(): http.RequestHandler {
  return requestHandler;
}
