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

import fs = require('fs');
import http = require('http');
import httpApi = require('./HttpApi');
import uuid = require('node-uuid');

var SETTINGS_PATH = './config/settings.json';
var METADATA_PATH = './config/metadata.json';

export interface Metadata {
  projectId: string;
  vmZone: string;
  vmName: string;
  vmId: string;
  vmSecret: string;
}

export interface Settings {
  metadata: Metadata;

  serverPort: number;
  ipythonPort: number;
}

export interface SettingsCallback {
  (error: Error, settings: Settings): void;
}

function loadMetadata(callback: httpApi.HttpCallback) {
  var host = process.env.METADATA_HOST || 'metadata.google.internal';
  var path = '/computeMetadata/v1/?recursive=true';
  var headers = { 'Metadata-Flavor': 'Google' };

  httpApi.get(host, path, /* args */ null, /* token */ null, headers, callback);
}

function initializeMetadata(settings: Settings, callback: SettingsCallback): void {
  function metadataCallback(e: Error, data: any) {
    if (e) {
      callback(e, null);
      return;
    }

    var metadata = <Metadata>{};
    metadata.projectId = data.project['project-id'];

    // Zone returned from metadata is of the form projects/id/zones/zone.
    metadata.vmZone = data.instance.zone.split('/').slice(-1)[0];

    // Hostname is of the form vm_name.c.project.internal
    metadata.vmName = data.instance.hostname.split('.')[0];

    // Create a unique id to identify this instance
    metadata.vmId = uuid.v4();

    // ID is a unique numeric ID assigned to the VM. We'll use it as the secret value,
    // for signing purposes.
    metadata.vmSecret = data.instance.id.toString();

    fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2), { encoding: 'utf8' });

    settings.metadata = metadata;
    callback(null, settings);
  }

  var host = process.env.METADATA_HOST || 'metadata.google.internal';
  var path = '/computeMetadata/v1/?recursive=true';
  var headers = { 'Metadata-Flavor': 'Google' };

  httpApi.get(host, path, /* args */ null, /* token */ null, headers, metadataCallback);
}

function invokeCallback(callback: SettingsCallback, error: Error, settings: Settings): void {
  process.nextTick(function() {
    callback(error, settings);
  });
}

export function loadSettings(callback: SettingsCallback): void {
  try {
    var settings = <Settings>JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));

    if (!fs.existsSync(METADATA_PATH)) {
      // Do some per-instance one-time setup
      initializeMetadata(settings, callback);
    }
    else {
      settings.metadata = <Metadata>JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8'));
      invokeCallback(callback, null, settings);
    }
  }
  catch (e) {
    invokeCallback(callback, e, null);
  }
}
