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
/// <reference path="../../../externs/ts/node/node-uuid.d.ts" />
/// <reference path="common.d.ts" />

import fs = require('fs');
import http = require('http');
import httpApi = require('./httpapi');
import uuid = require('node-uuid');

var SETTINGS_PATH = './config/settings.json';
var METADATA_PATH = './config/metadata.json';

function initializeMetadata(settings: common.Settings,
                            callback: common.Callback<common.Settings>): void {
  function metadataCallback(e: Error, data: any) {
    if (e) {
      callback(e, null);
      return;
    }

    var metadata: common.Metadata = {
      projectId: data.project['project-id'],
      versionId: (process.env['GAE_MODULE_NAME'] || 'ipython') + '.' +
                 (process.env['GAE_MODULE_VERSION'] || 'internal'),
      instanceId: uuid.v4()
    };

    fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2), { encoding: 'utf8' });

    settings.metadata = metadata;
    callback(null, settings);
  }

  var host = process.env.METADATA_HOST || 'metadata.google.internal';
  var path = '/computeMetadata/v1/?recursive=true';
  var headers: common.Map<string> = { 'Metadata-Flavor': 'Google' };

  httpApi.get(host, path, /* args */ null, /* token */ null, headers, metadataCallback);
}

function invokeCallback(callback: common.Callback<common.Settings>,
                        error: Error, settings: common.Settings): void {
  process.nextTick(function() {
    callback(error, settings);
  });
}

/**
 * Loads the configuration settings for the application to use.
 * On first run, this generates any dynamic settings and merges them into the settings result.
 * @param callback the callback to invoke once settings have been loaded.
 */
export function loadSettings(callback: common.Callback<common.Settings>): void {
  try {
    var settings = <common.Settings>JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    settings.ipythonWebServer = 'http://localhost:' + settings.ipythonPort;
    settings.ipythonSocketServer = 'ws://localhost:' + settings.ipythonPort;

    if (!fs.existsSync(METADATA_PATH)) {
      // Do some per-instance one-time setup on first-run.
      initializeMetadata(settings, callback);
    }
    else {
      // Otherwise just reload previously initialized metadata.
      settings.metadata = <common.Metadata>JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
      invokeCallback(callback, null, settings);
    }
  }
  catch (e) {
    invokeCallback(callback, e, null);
  }
}
