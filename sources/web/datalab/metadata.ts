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

import fs = require('fs');
import http = require('http');
import logging = require('./logging');
import url = require('url');

interface Creds {
  account: string;
  scopes: string;
  access_token:  string;
  expires_in: number;
  token_type: string;
}

interface FakeMetadata {
  project: string;
  project_number: string;
  creds: Creds;
}

const metadata: FakeMetadata = {
  project: process.env.PROJECT_ID,
  project_number: process.env.PROJECT_NUMBER,
  creds: {
    account: process.env.DATALAB_GIT_AUTHOR,
    scopes: "",
    access_token: "",
    expires_in: 0,
    token_type: "Bearer",
  },
};

function launchFakeServer(metadata: FakeMetadata, settings: common.AppSettings): void {
  const port = settings.fakeMetadataAddress.port;
  const host = settings.fakeMetadataAddress.host;
  logging.getLogger().info('Starting fake metadata server at http://%s:%d with %s',
                           host, port, JSON.stringify(metadata));

  const server = http.createServer((req, res) => {
    const parsed_url = url.parse(req.url, true);
    const urlpath = parsed_url.pathname;
    logging.getLogger().info('Service a fake metadata request at %s', urlpath);

    if (urlpath == '/computeMetadata/v1/project/numeric-project-id') {
      res.writeHead(200, { 'Metadata-Flavor': 'Google', 'Content-Type': 'application/text' });
      res.write(metadata.project_number);
    } else if (urlpath == '/computeMetadata/v1/project/project-id') {
      res.writeHead(200, { 'Metadata-Flavor': 'Google', 'Content-Type': 'application/text' });
      res.write(metadata.project);
    } else if (urlpath == '/computeMetadata/v1/instance/service-accounts/' ||
               urlpath == '/computeMetadata/v1/instance/service-accounts') {
      res.writeHead(200, { 'Metadata-Flavor': 'Google', 'Content-Type': 'application/text' });
      res.write('default/\n');
      res.write(metadata.creds.account + '/\n');
    } else if ((urlpath == '/computeMetadata/v1/instance/service-accounts/default/' ||
                urlpath == '/computeMetadata/v1/instance/service-accounts/' + metadata.creds.account + '/') &&
               (parsed_url.query['recursive'] || '').toLowerCase() == "true") {
      const accountJSON: any = {
        aliases: ["default"],
        email: metadata.creds.account,
        scopes: [metadata.creds.scopes],
      };
      res.writeHead(200, { 'Metadata-Flavor': 'Google', 'Content-Type': 'application/json' });
      res.write(JSON.stringify(accountJSON));
    } else if (urlpath == '/computeMetadata/v1/instance/service-accounts/default/email' ||
               urlpath == '/computeMetadata/v1/instance/service-accounts/' + metadata.creds.account + '/email') {
      res.writeHead(200, { 'Metadata-Flavor': 'Google', 'Content-Type': 'application/text' });
      res.write(metadata.creds.account);
    } else if (urlpath == '/computeMetadata/v1/instance/service-accounts/default/scopes' ||
               urlpath == '/computeMetadata/v1/instance/service-accounts/' + metadata.creds.account + '/scopes') {
      res.writeHead(200, { 'Metadata-Flavor': 'Google', 'Content-Type': 'application/text' });
      res.write(metadata.creds.scopes);
    } else if (urlpath == '/computeMetadata/v1/instance/service-accounts/default/token' ||
               urlpath == '/computeMetadata/v1/instance/service-accounts/' + metadata.creds.account + '/token') {
      const token: any = {
        access_token: metadata.creds.access_token,
        expires_in: metadata.creds.expires_in,
        token_type: metadata.creds.token_type,
      };
      res.writeHead(200, { 'Metadata-Flavor': 'Google', 'Content-Type': 'application/json' });
      res.write(JSON.stringify(token));
    } else if (urlpath == '' || urlpath == '/') {
      res.writeHead(200, { 'Metadata-Flavor': 'Google', 'Content-Type': 'application/text' });
      res.write('computeMetadata/');
    } else {
      res.writeHead(404);
    }
    res.end();
  });
  server.listen(port, host, 511, () => {
    // The `gcloud` tool uses a file in its config directory named 'gce' to
    // cache whether or not it should read credentials from the metadata server.
    //
    // Since our fake metadata server just connected, it's possible that an
    // earlier invocation of `gcloud` could have written that file. To account
    // for this, we overwrite the file with the value that indicates the tool
    // should read from the metadata server.
    const gceFile = settings.contentDir + '/datalab/.config/gce';
    try {
      fs.writeFileSync(gceFile, "True");
    } catch (ex) {
      // If the parent directory does not exist, we do not need to overwrite
      // the file. Ignore errors in this case, but log them just in case
      // there is something else wrong.
      logging.getLogger().info('Failure overwriting the file %s: %s', gceFile, ex);
    }
  });
}

/**
 * Initializes the GCE metadata service fake.
 */
export function init(settings: common.AppSettings): void {
  if (process.env.DATALAB_FAKE_METADATA_SERVER != 'true') {
    return;
  }
  launchFakeServer(metadata, settings);
}

function parseRequest(request: http.ServerRequest, callback: Function): void {
  let body : string = "";
  request.on('data', function(chunk: string) { body += chunk; });
  request.on('end', function() {
    callback(JSON.parse(body));
  });
}

/**
 * Implements the token submission request handling.
 * @param request the incoming token POST request.
 * @param response the outgoing response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  const requestUrl = url.parse(request.url);
  const path = requestUrl.pathname;
  if (request.url == '/api/creds' && 'POST' == request.method) {
    parseRequest(request, function(c: any): void {
      const creds = metadata.creds;
      for (const key of Object.keys(c)) {
        (creds as any)[key] = c[key];
      }
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('ok');
    });
  } else if (request.url == '/api/metadata' && 'POST' == request.method) {
    parseRequest(request, function(m: any): void {
      for (const key of Object.keys(m)) {
        (metadata as any)[key] = m[key];
      }
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('ok');
    });
  } else {
    response.writeHead(404, 'Not Found', { 'Content-Type': 'text/plain' });
    response.end();
  }
}

/**
 * Creates the health status request handler.
 * @param settings configuration settings for the application.
 * @returns the request handler to handle health requests.
 */
export function createHandler(settings: common.AppSettings): http.RequestHandler {
  return requestHandler;
}
