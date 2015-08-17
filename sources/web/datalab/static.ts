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

import fs = require('fs');
import http = require('http');
import logging = require('./logging');
import path = require('path');
import url = require('url');

var IPYTHON_DIR = '/usr/local/lib/python2.7/dist-packages/IPython/html';
var CONTENT_TYPES: common.Map<string> = {
  '.txt': 'text/plain',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

var contentCache: common.Map<Buffer> = {};

function getContent(filePath: string, cb: common.Callback<Buffer>): void {
  var content = contentCache[filePath];
  if (content != null) {
    process.nextTick(function() {
      cb(null, content);
    });
  }
  else {
    fs.readFile(filePath, function(error, content) {
      if (error) {
        cb(error, null);
      }
      else {
        contentCache[filePath] = content;
        cb(null, content);
      }
    });
  }
}

/**
 * Sends a static file as the response.
 * @param filePath the full path of the static file to send.
 * @param response the out-going response associated with the current HTTP request.
 */
function sendFile(filePath: string, response: http.ServerResponse) {
  var extension = path.extname(filePath);
  var contentType = CONTENT_TYPES[extension.toLowerCase()] || 'application/octet-stream';

  getContent(filePath, function(error, content) {
    if (error) {
      logging.getLogger().error(error, 'Unable to send static file: %s', filePath);

      response.writeHead(500);
      response.end();
    }
    else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content);
    }
  });
}

/**
 * Sends a static file located within the DataLab static directory.
 * @param filePath the relative file path of the static file to send.
 * @param response the out-going response associated with the current HTTP request.
 */
function sendDataLabFile(filePath: string, response: http.ServerResponse) {
  sendFile(path.join(__dirname, 'static', filePath), response);
}

/**
 * Sends a static file located within the IPython install.
 * @param filePath the relative file path of the static file within the IPython directory to send.
 * @param response the out-going response associated with the current HTTP request.
 */
function sendIPythonFile(relativePath: string, response: http.ServerResponse) {
  var filePath = path.join(IPYTHON_DIR, relativePath);
  fs.stat(filePath, function(e, stats) {
    if (e || !stats.isFile()) {
      response.writeHead(404);
      response.end();
    }

    sendFile(filePath, response);
  });
}

/**
 * Implements static file handling.
 * @param request the incoming file request.
 * @param response the outgoing file response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  var path = url.parse(request.url).pathname;

  if (path.lastIndexOf('/favicon.ico') > 0) {
    sendDataLabFile('datalab.ico', response);
  }
  else if ((path.lastIndexOf('/logo.png') > 0) ||
           (path.lastIndexOf('/ipynblogo.png') > 0)) {
    // TODO: Remove the check for the IPython version once we've switched to Jupyter
    sendDataLabFile('datalab.png', response);
  }
  else if (path.lastIndexOf('/custom.js') > 0) {
    sendDataLabFile('datalab.js', response);
  }
  else if (path.lastIndexOf('/custom.css') > 0) {
    sendDataLabFile('datalab.css', response);
  }
  else if ((path.indexOf('/static/extensions/') == 0) ||
           (path.indexOf('/static/require/') == 0)) {
    // Strip off the leading '/static/' to turn path into a relative path within the
    // static directory.
    sendDataLabFile(path.substr(8), response);
  }
  else {
    // Strip off the leading slash to turn path into a relative file path
    sendIPythonFile(path.substr(1), response);
  }
}

/**
 * Creates the static content request handler.
 * @param settings configuration settings for the application.
 * @returns the request handler to handle static requests.
 */
export function createHandler(settings: common.Settings): http.RequestHandler {
  return requestHandler;
}
