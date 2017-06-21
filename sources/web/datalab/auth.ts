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

/// <reference path="../../../third_party/externs/ts/node/node.d.ts" />
/// <reference path="../../../third_party/externs/ts/request/request.d.ts" />
/// <reference path="../../../third_party/externs/ts/googleapis/googleapis.d.ts" />
/// <reference path="common.d.ts" />

import childProcess = require('child_process');
import fs = require('fs');
import google = require('googleapis');
import http = require('http');
import logging = require('./logging');
import path = require('path');
import url = require('url');


var oauth2Client: any = undefined;

// These are the gcloud credentials and are not actually secret.
let clientId = '32555940559.apps.googleusercontent.com';
let clientSecret = 'ZmssLNjJy2998hD4CTg2ejr2';

// The application settings instance.
var appSettings: common.AppSettings;

let scopes = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/cloud-platform',
];

// Path to the root of the gcloud configuration.
function gcloudDir(): string {
  return path.join(appSettings.datalabRoot, '/content/datalab/.config');
}

// Path for user-specific credentials.
function userCredFile(): string {
  return path.join(gcloudDir(), '/credentials');
}

// Path for application default credentials.
function appCredFile(): string {
  return path.join(gcloudDir(), '/application_default_credentials.json');
}

// Path for shared boto config (used by gsutil).
function botoFile(): string {
  return path.join(appSettings.datalabRoot, '/etc/boto.cfg');
}

/**
 * Take a id_token_id and decode it. These are base64 but with the some character substitutions and the
 * trailing '='s removed, so we first revert those and then run through base64 decoding.
 */
function base64decodeSegment(str: string) {
  str += Array(5 - str.length % 4).join('=');
  str= str.replace(/\-/g, '+').replace(/_/g, '/');
  return new Buffer(str, 'base64').toString();
}

/**
 * gcloudAccountCache is a pull-through cache of the `gcloud` active account
 * that automatically flushes after 60 seconds and is manually flushed after
 * the user signs out or sets the account.
 */
class gcloudAccountCache {
  _cachedAccount: string = "";
  _cachedDate: Date = null;

  clear() {
    this._cachedAccount = "";
  }

  get(): string {
    const now = new Date();
    if (this._cachedAccount !== "") {
      const elapsedMilliseconds = now.getTime() - this._cachedDate.getTime();
      if (elapsedMilliseconds > (60 * 1000)) {
        this._cachedAccount = "";
      }
    }
    if (this._cachedAccount == "") {
      // Ask gcloud which account we are using.
      try {
        var account = childProcess.execSync(
          'gcloud auth list --filter=status:ACTIVE --format "value(account)"',
          {env: process.env});
        this._cachedAccount = account.toString().trim();
        this._cachedDate = now;
      } catch (err) {
        logging.getLogger().error(err, 'Failed to get the gcloud account. stderr: %s', err.stderr);
        return "unknown";
      }
    }
    return this._cachedAccount;
  }
}

let accountCache: gcloudAccountCache = new gcloudAccountCache();

export function getGcloudAccount(): string {
    return accountCache.get();
}

function setGcloudAccount(email: string) {
  accountCache.clear();
  // Tell gcloud which account we are using.
  try {
    childProcess.execSync('gcloud config set account ' + email, {env: process.env});
  } catch (err) {
    logging.getLogger().error(err, 'Failed to set gcloud account. stderr: %s', err.stderr);
    return;
  }
}

function saveUserCredFile(tokens: any): string {
  var segments = tokens.id_token.split('.');
  var payload = JSON.parse(base64decodeSegment(segments[1]));
  fs.writeFileSync(userCredFile(),
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
  return payload.email;
}

function saveApplicationCredFile(tokens: any) {
  fs.writeFileSync(appCredFile(),
      JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        type: "authorized_user"
      })
  );
}

function saveBotoFile(tokens: any) {
  // Create botoFile and set refresh token to get gsutil working.
  // See https://cloud.google.com/storage/docs/gsutil/commands/config.
  var botoContent:string = '[Credentials]\ngs_oauth2_refresh_token = ' + tokens.refresh_token;
  fs.writeFileSync(botoFile(), botoContent);
}

/**
 * Save the tokens in a credentials file that Datalab and gcloud can both use.
 */
function persistCredentials(tokens: any): string {
  accountCache.clear();
  if (!fs.existsSync(gcloudDir())) {
    fs.mkdirSync(gcloudDir());
  }
  saveApplicationCredFile(tokens);
  saveBotoFile(tokens);
  return saveUserCredFile(tokens);
}

export function isSignedIn(gcloudAccount: string): boolean {
  return (gcloudAccount != '' && gcloudAccount != 'unknown');
}

function getPortNumber(request: http.ServerRequest): number {
  if (request.headers['host']) {
    var parsedHost = url.parse('http://' + request.headers['host']);
    if (parsedHost['port']) {
      return parseInt(parsedHost['port']);
    }
  }
  return 8081;
}

function setOauth2Client(request: http.ServerRequest): void {
  if (!oauth2Client) {
    var OAuth2:any = google.auth.OAuth2;
    // TODO(ojarjur): Ideally, we would get the host from the parsed_url rather
    // than hard-coding it. However, the client ID and secret we are using
    // are limited to localhost only. We should consider making this
    // configurable, or using the OAuth flow for non-web applications.
    oauth2Client = new OAuth2(clientId, clientSecret,
        'http://localhost:' + getPortNumber(request) + '/oauthcallback');
  }
}

function redirect(response: http.ServerResponse, referer: string) {
  if (referer == 'popup') {
    // Other frontends that connect to Datalab may choose to use a popup
    // instead of a full redirect for auth.  Close the window if this came
    // from a pop-up.
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end(
        '<html><body onload="javascript:close()">Authorization succeeded. ' +
        'This window should close automatically</body></html>');
  } else {
    response.statusCode = 302;
    response.setHeader('Location', referer);
    response.end();
  }
}

export function handleAuthFlow(request: http.ServerRequest, response: http.ServerResponse,
    parsed_url: any, settings: any): void {
  var path = parsed_url.pathname;
  var query = parsed_url.query;
  if (path.indexOf('/signout') == 0) {
    if (fs.existsSync(userCredFile())) {
      try {
        fs.unlinkSync(userCredFile());
      } catch (e) {
        logging.getLogger().error('Could not delete ' + userCredFile() + ': ' + e);
      }
    }
    if (fs.existsSync(appCredFile())) {
      try {
        fs.unlinkSync(appCredFile());
      } catch (e) {
        logging.getLogger().error('Could not delete ' + appCredFile() + ': ' + e);
      }
    }
    if (fs.existsSync(botoFile())) {
      try {
        fs.unlinkSync(botoFile());
      } catch (e) {
        logging.getLogger().error('Could not delete ' + botoFile() + ': ' + e);
      }
    }
    accountCache.clear();
  } else if (path.indexOf('/oauthcallback') == 0) {  // Return from auth flow.
    setOauth2Client(request);
    if (query.code) {
      oauth2Client.getToken(query.code, function (err:any, tokens:any) {
        if (err) {
          logging.getLogger().info('Auth failed');
          response.writeHead(403);
          response.end();
        } else {
          logging.getLogger().info('Auth succeeded');
          oauth2Client.setCredentials(tokens);
          // Push them to Jupyter and handle request.
          var email = persistCredentials(tokens);
          redirect(response, query.state);
        }
      });
    }
    return;
  } else if (path.indexOf('/signin') == 0 && !isSignedIn(getGcloudAccount())) {
    // Do auth.
    // TODO(gram): instead of initiating it here we should add a sign in button to our templates so it becomes
    // user-initiated.
    var referer = decodeURIComponent(query.referer);
    logging.getLogger().info('Starting auth from referer ' + referer);
    setOauth2Client(request);
    var url_:string = oauth2Client.generateAuthUrl({
      access_type: 'offline', // 'offline' gets refresh_token
      scope: scopes,
      state: referer
    });
    response.statusCode = 302;
    response.setHeader('Location', url_);
    response.end();
    return;
  }

  // Return to referer.
  var referer = decodeURIComponent(query.referer);
  redirect(response, referer);
}

export function init(settings: common.AppSettings) {
  appSettings = settings;
  if (fs.existsSync(appCredFile())) {
    var tokensContent:string = fs.readFileSync(appCredFile(), 'utf8');
    var tokens:any = JSON.parse(tokensContent);
    saveBotoFile(tokens);
  }
}
