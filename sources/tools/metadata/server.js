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

/**
 * Implements a server that emulates (some) of the API exposed by the cloud service on GCE VMs.
 * The server port defaults to 80, but can be customized by setting the METADATA_PORT environment
 * variable.
 *
 * The server relies on the gcloud tool from the SDK, being present on the path, and
 * configured (auth token, and selected current project).
 */

var childProcess = require('child_process'),
    http = require('http'),
    url = require('url'),
    util = require('util');

var DEFAULT_PORT = 80;
var HTTP_STATUS_OK = 200;
var HTTP_STATUS_NOTFOUND = 404;
var HTTP_STATUS_ERROR = 500;


/**
 * The set of metadata names supported. Each name is associated with a request path that the
 * server handles, and an optional formatter to produce the response data.
 */
var supportedMetadata = {
  authToken: {
    path: '/computemetadata/v1/instance/service-accounts/default/token',
    command: 'gcloud auth print-access-token',
    formatter: function(output) {
      return { access_token: output.trim() };
    }
  },
  projectId: {
    path: '/computemetadata/v1/project/project-id',
    command: 'gcloud config list --format json project',
    formatter: function(output) {
      var data = JSON.parse(output);
      return data.core.project;
    }
  }
};

/**
 * Looks up the specified metadata.
 * @param md The metadata to lookup.
 * @param cb Callback to invoke with results.
 */
function lookupMetadata(md, cb) {
  try {
    process.env['TERM'] = 'vt-100';
    childProcess.exec(md.command, function(error, stdout, stderr) {
      if (error) {
        console.error(stderr);
        cb(error, null);
      }
      else {
        var value = md.formatter(stdout.trim());
        cb(null, value);
      }
    });
  }
  catch (e) {
    process.nextTick(function() {
      cb(e, null);
    });
  }
}

/**
 * Handles server requests for metadata.
 * @param req The incoming HTTP request.
 * @param resp The outgoing HTTP response.
 */
function requestHandler(req, resp) {
  console.log(req.url);

  function dataCallback(error, data) {
    var status = HTTP_STATUS_OK;
    var contentType = 'text/plain';
    var content = data;

    if (error) {
      status = HTTP_STATUS_ERROR;
      content = error.toString();
    }
    else if (typeof data != 'string') {
      contentType = 'application/json';
      content = JSON.stringify(data);
    }

    resp.writeHead(status, {'Content-Type': contentType});
    resp.write(content);
    resp.end();
  }

  var path = url.parse(req.url).path.toLowerCase();
  for (var name in supportedMetadata) {
    var md = supportedMetadata[name];

    if (path == md.path) {
      lookupMetadata(md, dataCallback);
      return;
    }
  }

  // The gcloud-auth-library uses the following "metadata-flavor" header check for validating
  // the existence of the GCE metadata service.
  resp.setHeader('metadata-flavor', 'Google');

  resp.writeHead(HTTP_STATUS_NOTFOUND);
  resp.end();
}


/**
 * The main entrypoint for the application. This creates an HTTP server, and starts listening
 * for incoming requests.
 */
function main() {
  var server = http.createServer(requestHandler);
  server.listen(DEFAULT_PORT);

  console.log('Metadata server started at http://localhost:' + DEFAULT_PORT + '/ ...');
}


main();
