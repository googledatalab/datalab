/*
 * Copyright 2016 Google Inc. All rights reserved.
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
/// <reference path="../../../externs/ts/request/request.d.ts" />
/// <reference path="../../../externs/ts/googleapis/googleapis.d.ts" />
/// <reference path="common.d.ts" />

import childProcess = require('child_process');
import fs = require('fs');
import google = require('googleapis');
import http = require('http');
import logging = require('./logging');


var oauth2Client: any = undefined;

// These are the gcloud credentials and are not actually secret.
let clientId = '32555940559.apps.googleusercontent.com';
let clientSecret = 'ZmssLNjJy2998hD4CTg2ejr2';
let gcloudDir = process.env.CLOUDSDK_CONFIG || '/root/.config/gcloud';
let userCredFile = gcloudDir + '/credentials';
let appCredFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || (gcloudDir + '/application_default_credentials.json')

let scopes = [
  'https://www.googleapis.com/auth/userinfo.email',
  //'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cloud-platform',
];

/**
 * Take a id_token_id and decode it. These are base64 but with the some character substitutions and the
 * trailing '='s removed, so we first revert those and then run through base64 decoding.
 */
function base64decodeSegment(str: string) {
  str += Array(5 - str.length % 4).join('=');
  str= str.replace(/\-/g, '+').replace(/_/g, '/');
  return new Buffer(str, 'base64').toString();
}

function setGcloudAccount(email: string) {
  // Tell gcloud which account we are using.
  childProcess.exec('gcloud config set account ' + email, {env: process.env}, function(err, stdout, stderr) {
    if (err) {
      logging.getLogger().error(err, 'Failed to set gcloud account. stderr: %s', stderr);
      return;
    }
  });
}

function saveUserCredFile(tokens: any) {
  var segments = tokens.id_token.split('.');
  var payload = JSON.parse(base64decodeSegment(segments[1]));
  fs.writeFileSync(userCredFile,
      JSON.stringify({
        data:
            [
              {
                credential: {
                  _class: "OAuth2Credentials",
                  _module: "oauth2client.client",
                  access_token: tokens.access_token,
                  client_id: clientId,
                  client_secret: clientSecret,
                  id_token: payload,
                  invalid: false,
                  refresh_token: tokens.refresh_token,
                  revoke_uri: "https://accounts.google.com/o/oauth2/revoke",
                  token_expiry: (new Date(tokens.expiry_date)).toISOString(),
                  token_response: {
                    access_token: tokens.access_token,
                    expires_in: 3600,
                    id_token: tokens.id_token,
                    refresh_token: tokens.refresh_token,
                    token_type: "Bearer"
                  },
                  token_uri: "https://accounts.google.com/o/oauth2/token",
                  user_agent: "Cloud SDK Command Line Tool"
                },
                key: {
                  account: payload.email,
                  type: "google-cloud-sdk"
                }
              }
            ],
        file_version: 1
      })
  );
  // Tell gcloud which account we are using.
  setGcloudAccount(payload.email);
}

function saveApplicationCredFile(tokens: any) {
  fs.writeFileSync(appCredFile,
      JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        type: "authorized_user"
      })
  );
}

/**
 * Save the tokens in a credentials file that Datalab and gcloud can both use.
 */
function persistCredentials(tokens: any) {
  if (!fs.existsSync(gcloudDir)) {
    fs.mkdirSync(gcloudDir);
  }
  saveApplicationCredFile(tokens);
  saveUserCredFile(tokens);
}

export function handleAuthFlow(request: http.ServerRequest, response: http.ServerResponse, parsed_url: any): boolean {
  var path = parsed_url.pathname;
  if (path.indexOf('/oauthcallback') == 0) {  // Return from auth flow.
    var query = parsed_url.query;
    if (query.code) {
      oauth2Client.getToken(query.code, function (err:any, tokens:any) {
        if (err) {
          response.writeHead(403);
          response.end();
        } else {
          logging.getLogger().info('Got tokens');
          oauth2Client.setCredentials(tokens);
          // Push them to Jupyter and handle request.
          persistCredentials(tokens);
          response.statusCode = 302;
          response.setHeader('Location', query.state);
          response.end();
        }
      });
    }
  } else if (!oauth2Client && process.env.DATALAB_ENV == 'local' && !fs.existsSync(appCredFile)) {
    // Do auth.
    // TODO(gram): instead of initiating it here we should add a sign in button to our templates so it becomes
    // user-initiated.
    var OAuth2:any = google.auth.OAuth2;
    // TODO(gram): can we get the host and port from somewhere instead of hard-coding?
    oauth2Client = new OAuth2(clientId, clientSecret, 'http://localhost:8081/oauthcallback');
    var url_:string = oauth2Client.generateAuthUrl({
      access_type: 'offline', // 'offline' gets refresh_token
      scope: scopes,
      state: request.url
    });
    response.statusCode = 302;
    response.setHeader('Location', url_);
    response.end();
  } else {
    // Not local or already done auth; just handle it.
    return true;
  }
  return false;  // Don't handle the request.
}
