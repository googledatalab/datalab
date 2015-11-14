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


import logging = require('./logging');
var googleapis = require('googleapis');

/**
 * The datastore service used to query Datastore to see if a user is whitelisted.
 */
var datastore : any;

/**
 * The authentication Url that it will redirect users to if needed.
 */
var authUrl: string;

/**
 * Checks whether a given user has access to this instance of Datalab.
 */
export function checkUserAccess(userId: string, cb: common.Callback<boolean>) {
  datastore.datasets.lookup(
    {
      resource: {
        keys: [{path: [{kind: 'DatalabUser', name: userId}]}]
      }
    },
    function(e: Error, result: any) {
      if (e) {
        logging.getLogger().error(e, 'Failed to look up user.');
      }
      var found: boolean = result && result.found && (result.found.length > 0);
      cb && cb(e, found);
    }
  );
}

/**
 * Checks whether a given user has access to this instance of Datalab.
 */
export function getAuthenticationUrl(): string {
  return authUrl;
}

export function init(settings: common.Settings, cb: common.Callback0) : void {
  authUrl = "http://stage-dot-cloud-datalab-deploy.appspot.com?startinproject="
            + settings.projectId + "&name=" + settings.instanceName;

  var compute = new googleapis.auth.Compute();
  if (settings.metadataHost) {
    logging.getLogger().info("overriding auth url");
    // For local run, we change the token url to be a local metadata server
    // by overriding its options.
    compute.opts.tokenUrl = "http://" + settings.metadataHost
      + "/computemetadata/v1/instance/service-accounts/default/token";
  }

  compute.getAccessToken(function(e: Error, token: string) {
    if (e) {
      logging.getLogger().error(e, 'Failed to get service account access token');
      cb && cb(e);
    } 
    else {
      datastore = googleapis.datastore({
        version: 'v1beta2',
        auth: compute,
        projectId: settings.projectId,
        params: {datasetId: settings.projectId}
      });
      logging.getLogger().info("Successfully got access token and created datastore service");
      cb && cb(null);
    }
  });
}
