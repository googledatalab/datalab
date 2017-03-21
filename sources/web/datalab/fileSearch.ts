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
var tooManyFiles: boolean = false;
const fileCountLimit = 1000000;

// this is matched by the client javascript to display a message that
// there are more results than shown. Make sure these are in sync
const clientResultSize = 20; 

/**
 * Implements the file search/filter request handling.
 * @param request the incoming search request.
 * @param response the outgoing search response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  const parsedUrl = url.parse(request.url, true);
  const pattern = parsedUrl.query['pattern'];  
  const statusCheck = parsedUrl.query['status'];

  response.writeHead(200, { 'Content-Type': 'application/json' });
  if (pattern !== undefined) {
    const results = filter(pattern);
    response.write(JSON.stringify(results));
  } else if (statusCheck !== undefined) {
    response.write(JSON.stringify({
      tooManyFiles: tooManyFiles
    }));
  }
  response.end();
}

/**
 * Builds an index of all files in the content directory to make search faster
 */
export function indexFiles(): void {
  const startTime = process.hrtime();
  index(appSettings.contentDir + '/', () => {
    const indexTime = process.hrtime(startTime);
    if (tooManyFiles) {
      logging.getLogger().error('Hit file index maximum limit, searching files should be disabled');
    } else {
      logging.getLogger().info('Finished indexing ' + fileIndex.length + ' files in ' + indexTime[0] + ' seconds');
    }
  });
}

/**
 * Recursively indexes all files under the given search path into the global fileIndex object
 * @param searchpath the path prefix to start indexing
 */
function index(searchpath: string, callback: Function): void {
  // stop the search if we've reached the file count limit
  if (fileIndex.length >= fileCountLimit) {
    tooManyFiles = true;
    return callback();
  }
  fs.readdir(searchpath, (err, list) => {
    if (err) {
      logging.getLogger().error('Could not read dir ' + searchpath);
      return callback();
    }
    let remaining = list.length;
    if (remaining === 0) {
      return callback();
    }
    list.forEach((file) => {
      // ignore hidden files/dirs
      if (file[0] === '.') {
        if (--remaining === 0) {
          callback();
        }
        return;
      }

      const filename = path.join(searchpath, file);
      fs.lstat(filename, (err, stat) => {
        if (err) {
          remaining--;
          callback();
        } else {
          if (stat.isDirectory()) {
            index(filename, () => {
              if (--remaining === 0) {
                callback();
              }
            });
          } else {
            fileIndex.push(filename.substr(appSettings.contentDir.length + 1));
            if (--remaining === 0) {
              callback();
            }
          }
        }
      });
    });
  });
}

/**
 * Filters the file index based on the provided pattern
 * @param pattern the search pattern
 * @returns a list of matches that are superstrings of pattern
 */
function filter(pattern: string): string[] {
  pattern = pattern.toLowerCase();
  return fileIndex.filter((item) => {
    return item.toLowerCase().indexOf(pattern) > -1;
  }).slice(0, clientResultSize);
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
