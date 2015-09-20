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

import http = require('http');
import logging = require('./logging');
import path = require('path');
import url = require('url');

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

export function init(settings: common.Settings): void {
  appSettings = settings;
}

/**
 * Get user id from request. User Id is typically an email address.
 */
export function getUserId(request: http.ServerRequest): string {
  if (appSettings.supportUserOverride) {
    // Try cookie first.
    if (request.headers.cookie) {
      var cookies = request.headers.cookie.split(';');
      for (var i = 0; i < cookies.length; ++i) {
        var parts = cookies[i].split('=');
        if (parts.length == 2 && parts[0] == 'datalab_user' && parts[1]) {
          return parts[1];
        }
      }
    }
  }

  return request.headers['x-appengine-user-email'] || appSettings.instanceUser || 'anonymous';
}

/**
 * Get user directory which stores the user's notebooks.
 * the directory is root_dir + emailaddress, such as '/content/user@domain.com'.
 */
export function getUserDir(userId: string): string {
  if (!appSettings.useWorkspace) {
    // If the workspace feature is not enabled, then just use the content directory specified
    // in configuration.
    return appSettings.contentDir;
  }

  // Forward slash '/' is allowed in email but not in file system so replace it.
  return path.join(appSettings.contentDir, userId.replace('/', '_fsfs_'));
}

/**
 * Set 'datalab_user' cookie to override user so we can easily simulate mult-user requests.
 * Only do so for local runs.
 */
export function maybeSetUserIdCookie(request: http.ServerRequest,
                                     response: http.ServerResponse): void {
  if (appSettings.supportUserOverride) {
    var userFromQuery = url.parse(request.url, /* parseQuery */ true).query['datalab_user'];
    if (userFromQuery) {
      response.setHeader('set-cookie', 'datalab_user=' + userFromQuery);
      logging.getLogger().info('set userId %s to cookie', userFromQuery);
    }
  }
}
