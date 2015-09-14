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

import childProcess = require('child_process');
import fs = require('fs');
import uuid = require('node-uuid');
import path = require('path');
import util = require('util');

var SETTINGS_FILE = 'settings.%s.json';
var METADATA_FILE = 'metadata.json';

interface Metadata {
  instanceId: string;
}

/**
 * Loads the configuration settings for the application to use.
 * On first run, this generates any dynamic settings and merges them into the settings result.
 * @returns the settings object for the application to use.
 */
export function loadSettings(): common.Settings {
  var env = process.env.DATALAB_ENV || 'cloud';
  var settingsPath = path.join(__dirname, 'config', util.format(SETTINGS_FILE, env));
  var metadataPath = path.join(__dirname, 'config', METADATA_FILE);

  if (!fs.existsSync(settingsPath)) {
    console.log('Settings file %s not found.', settingsPath);
    return null;
  }

  try {
    var metadata: Metadata = null;
    if (!fs.existsSync(metadataPath)) {
      // Create an write out metadata on the first run if it doesn't exist.
      metadata = { instanceId: uuid.v4() };
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), { encoding: 'utf8' });
    }
    else {
      // Load metadata from the file system. This is written out on the first run.
      metadata = <Metadata>JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    }

    var settings = <common.Settings>JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    settings.instanceUser = process.env['DATALAB_USER'] || '';
    settings.instanceId = metadata.instanceId;
    settings.versionId = process.env['DATALAB_VERSION'] || '';
    settings.projectId = process.env['GAE_LONG_APP_ID'] || process.env['DATALAB_PROJECT_ID'] || '';

    if (env == 'cloud') {
      var metadataCommand =
        'curl -H "Metadata-Flavor=Google" ' +
        'http://metadata.google.internal/computeMetadata/v1beta1/project/numeric-project-id';
      settings.projectNumber = childProcess.execSync(metadataCommand, { encoding: 'utf8' });
    }
    else {
      settings.projectNumber = process.env['DATALAB_PROJECT_NUM'];
    }

    return settings;
  }
  catch (e) {
    console.log(e);
    return null;
  }
}
