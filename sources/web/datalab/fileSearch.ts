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
/// <reference path="../../../third_party/externs/ts/chokidar/chokidar.d.ts" />
/// <reference path="common.d.ts" />

import http = require('http');
import url = require('url');
import fs = require('fs');
import path = require('path');
import logging = require('./logging');
import chokidar = require('chokidar');

let appSettings: common.Settings;
let fileIndex: string[] = [];
let indexReady: boolean = false;
let tooManyFiles: boolean = false;
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
    const results = filter(pattern, fileIndex, clientResultSize);
    response.write(JSON.stringify(results));
  } else if (statusCheck !== undefined) {
    response.write(JSON.stringify({
      tooManyFiles: tooManyFiles,
      indexSize: fileIndex.length,
      indexReady: indexReady
    }));
  }
  response.end();
}

/**
 * Builds an index of all files in the content directory to make search faster
 */
export function indexFiles(): void {
  const startTime = process.hrtime();
  logging.getLogger().info('Started indexing file system');
  chokidar.watch(appSettings.contentDir + '/', {
      usePolling: true,
      interval: 1000,               // we don't need high frequency polling
      ignored: /(^|[\/\\])\../,     // ignore dot files/dirs
      ignorePermissionErrors: true, // ignore files with no permissions
    })
    .on('add', (addedPath) => {
      fileIndex.push(addedPath.substr(appSettings.contentDir.length + 1));
    })
    .on('unlink', (deletedPath) => {
      deletedPath = deletedPath.substr(appSettings.contentDir.length + 1);
      let pos = fileIndex.indexOf(deletedPath);
      if (pos > -1) {
        fileIndex.splice(pos, 1);
      }
    })
    .on('ready', () => {
      indexReady = true;
      const indexTime = process.hrtime(startTime);
      logging.getLogger().info('Finished indexing ' + fileIndex.length + ' files in ' + indexTime[0] + ' seconds');
    })
    .on('raw', () => {
      if (!indexReady) {
        indexReady = true;
        const indexTime = process.hrtime(startTime);
        logging.getLogger().info('Finished indexing ' + fileIndex.length + ' files in ' + indexTime[0] + ' seconds');
        logging.getLogger().error('Indexing threw raw event');
      }
    })
    .on('error', () => {
      indexReady = true;
      const indexTime = process.hrtime(startTime);
      logging.getLogger().info('Finished indexing ' + fileIndex.length + ' files in ' + indexTime[0] + ' seconds');
      logging.getLogger().error('Indexing threw error event');
    });
}

/**
 * Filters the file index based on the provided pattern
 * @param pattern the search pattern
 * @param data the data to filter
 * @param returnLength the number of results to return
 * @returns a list of matches that are superstrings of pattern
 */
function filter(pattern: string, data: string[], returnLength: number): string[] {
  pattern = pattern.toLowerCase();
  return data.filter((item) => {
    return item.toLowerCase().indexOf(pattern) > -1;
  }).slice(0, returnLength);
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
