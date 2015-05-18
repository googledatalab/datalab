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
 * Utilities for interacting with the GCE metadata service.
 */
/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../../../externs/ts/node/request.d.ts" />
import request = require('request');
import util = require('util');


/**
 * URL for fetching the project id from the compute metadata service.
 */
var projectIdMetadataUrl = 'http://metadata.google.internal/computeMetadata/v1/project/project-id';

/**
 * GCS bucket name pattern for notebook persistence.
 *
 * Pattern: "<project id>-ipython"
 */
var notebookStorageBucketPattern = '%s-ipython';

/**
 * Gets the current GCP project ID from the GCE metadata service.
 *
 * @param callback Completion callback to invoke with either an error or the project ID.
 */
export function getProjectId(callback: app.Callback<string>): void {
  var options = {
    url: projectIdMetadataUrl,
    headers: {'Metadata-Flavor': 'Google'}
  };

  request(options, (error, response, projectId) => {
    if (error) {
      callback(error);
      return;
    }

    callback(null, projectId);
  });
}

/**
 * Gets the name of the GCS bucket to use for project-associated notebook persistence.
 *
 * @param callback Completion callback to invoke with the GCS bucket name.
 */
export function getProjectStorageBucket(callback: app.Callback<string>): void {
  getProjectId((error, projectId) => {
    if (error) {
      callback(error);
      return;
    }

    callback(null, util.format(notebookStorageBucketPattern, projectId));
  });
}
