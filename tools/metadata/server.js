/*
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Implements a server that emulates (some) of the API exposed
 * by the cloud metadata service on GCE VMs.
 * The server port defaults to 80, but can be customized by setting the
 * METADATA_PORT environment variable.
 *
 * The server relies on the gcloud tool from the SDK, being present on
 * the path, and configured (auth token, and selected current project).
 */

var http = require('http'),
    url = require('url'),
    gcloud = require('./gcloud.js');


/**
 * The default HTTP port that the server listens on.
 * @const
 */
var DEFAULT_PORT = 80;


/**
 * HTTP status codes used in the code below.
 * @const
 */
var HTTP_STATUS = {
  OK: 200,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};


/**
 * Formats the auth token as a JSON object.
 * @param {string} data The auth token data.
 * @return {{access_token: string}} The JSON object containing the auth token.
 */
function authTokenFormatter(data) {
  return {
    access_token: data
  };
}


/**
 * The set of metadata names supported. Each name is associated with a
 * request path that the server handles, and an optional formatter
 * to produce the response data.
 */
var metadata = {
  authToken: {
    path: '/computemetadata/v1/instance/service-accounts/default/token',
    formatter: authTokenFormatter
  },
  projectId: {
    path: '/computemetadata/v1/project/project-id'
  }
};


/**
 * Handles server requests for metadata.
 * @param {!Object} req The incoming HTTP request.
 * @param {!Object} resp The outgoing HTTP response.
 */
function handler(req, resp) {
  console.log(req.url);

  function dataCallback(error, data) {
    var status = HTTP_STATUS.OK;
    var contentType = 'text/plain';
    var content = data;

    if (error) {
      status = HTTP_STATUS.INTERNAL_SERVER_ERROR;
      content = error.toString();
    } else if (typeof data != 'string') {
      contentType = 'application/json';
      content = JSON.stringify(data);
    }

    resp.writeHead(status, {'Content-Type': contentType});
    resp.write(content);
    resp.end();
  }

  var path = url.parse(req.url).path.toLowerCase();
  for (var name in metadata) {
    var md = metadata[name];

    if (path == md.path) {
      gcloud.metadata(name, md.formatter, dataCallback);
      return;
    }
  }

  resp.writeHead(HTTP_STATUS.NOT_FOUND);
  resp.end();
}


/**
 * The main entrypoint for the application. This creates an HTTP
 * server, and starts listening for incoming requests.
 */
function main() {
  var port = parseInt(process.env['METADATA_PORT'] || DEFAULT_PORT, 10);

  var server = http.createServer(handler);
  server.listen(port);

  console.log('Metadata server started at http://localhost:' + port + '/ ...');
}


main();
