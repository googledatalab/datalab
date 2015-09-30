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

/// <reference path="../../../externs/ts/node/node.d.ts" />
/// <reference path="common.d.ts" />

import crypto = require('crypto');
import https = require('https');
import qs = require('querystring');
import util = require('util');

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

export function initialize(settings: common.Settings): void {
  appSettings = settings;
}

function emitLog(logEvent: string, data: common.Map<string>): void {
  try {
    var options: any = {
      method: 'POST',
      hostname: appSettings.logEndpoint,
      port: 443,
      path: util.format('/log/%s?%s', logEvent, qs.stringify(data))
    };
  
    var request = https.request(options, function(response) {});
    request.on('error', function() {
      // Going to assume this is benign, and a future log will succeed.
      // Would rather not have this error getting listed when searching for any
      // real errors.
    });
    request.end();
  }
  catch (e) {
    // Same as above; silently ignoring the exception...
  }
}

export function logPage(page: string, path: string, user: string): void {
  user = user || '0';
  var data: common.Map<string> = {
    project: appSettings.projectNumber,
    instance: appSettings.instanceId,
    version: appSettings.versionId,
    release: appSettings.release,
    page: page,
    path: hashPath(path),
    user: user
  };
  emitLog('page', data);
}

export function logStart(): void {
  var data: common.Map<string> = {
    project: appSettings.projectNumber,
    instance: appSettings.instanceId,
    version: appSettings.versionId,
    release: appSettings.release
  };
  emitLog('start', data);
}

export function hashPath(path: string, algorithm?: string): string {
  // By default, use SHA1 hash
  var algorithm = algorithm || 'sha1';

  // Google Analytics requires paths to be anonymized using SHA256 hash
  return crypto.createHash(algorithm).update(path).digest('hex');
}
