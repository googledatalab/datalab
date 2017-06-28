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

/// <reference path="../../../third_party/externs/ts/node/node.d.ts" />
/// <reference path="../../../third_party/externs/ts/node/node-uuid.d.ts" />
/// <reference path="common.d.ts" />

import childProcess = require('child_process');
import fs = require('fs');
import http = require('http');
import uuid = require('node-uuid');
import path = require('path');
import querystring = require('querystring');
import url = require('url');
import util = require('util');
import idleTimeout = require('./idleTimeout');
import userManager = require('./userManager');

var SETTINGS_FILE = 'settings.json';
var DEFAULT_USER_SETTINGS_FILE = 'userSettings.json';
var METADATA_FILE = 'metadata.json';
var BASE_PATH_FILE = 'basePath.json';
const IDLE_TIMEOUT_KEY = 'idleTimeoutInterval';

interface Metadata {
  instanceId: string;
}

/**
 * Loads the configuration settings for the application to use.
 * On first run, this generates any dynamic settings and merges them into the settings result.
 * @returns the settings object for the application to use.
 */
export function loadAppSettings(): common.AppSettings {
  var settingsPath = path.join(__dirname, 'config', SETTINGS_FILE);
  var basePathFile = path.join(__dirname, 'config', BASE_PATH_FILE);
  var metadataPath = path.join(__dirname, 'config', METADATA_FILE);

  if (!fs.existsSync(settingsPath)) {
    console.log('App settings file %s not found.', settingsPath);
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

    const settings = <common.AppSettings>JSON.parse(fs.readFileSync(settingsPath, 'utf8') || '{}');
    settings.versionId = process.env['DATALAB_VERSION'] || '';
    if (process.env['DATALAB_CONFIG_URL']) {
      settings.configUrl = process.env['DATALAB_CONFIG_URL'];
    }
    if (!fs.existsSync(basePathFile)) {
      console.log('Base path setting file not found, falling back to empty path.');
      settings.datalabBasePath = '';
    } else {
      settings.datalabBasePath = JSON.parse(fs.readFileSync(basePathFile, 'utf8'));
    }
    const settingsOverrides = process.env['DATALAB_SETTINGS_OVERRIDES'];
    if (settingsOverrides) {
      // Allow overriding individual settings via JSON provided as an environment variable.
      const overrides = JSON.parse(settingsOverrides);
      for (const key of Object.keys(overrides)) {
        (<any>settings)[key] = overrides[key];
      }
    }

    // Normalize the base path to include "/" characters.
    if (settings.datalabBasePath.indexOf("/") != 0) {
      settings.datalabBasePath = "/" + settings.datalabBasePath;
    }
    if (settings.datalabBasePath.lastIndexOf("/") != settings.datalabBasePath.length - 1) {
      settings.datalabBasePath = settings.datalabBasePath + "/";
    }
    return settings;
  }
  catch (e) {
    console.log(e);
    return null;
  }
}

/**
 * Loads the path of the configuration directory for the user.
 *
 * @returns the path of the user's config directory.
 */
export function getUserConfigDir(userId: string): string {
  var userDir = userManager.getUserDir(userId);
  var configPath = path.join(userDir, 'datalab', '.config');
  return configPath;
}

/**
 * Copies the default user settings into the user's directory.
 */
function copyDefaultUserSettings(userId: string) {
  var userSettingsPath = path.join(getUserConfigDir(userId), SETTINGS_FILE);
  const defaultUserSettingsPath = path.join(__dirname, 'config', DEFAULT_USER_SETTINGS_FILE);
  console.log('Copying default settings: ' + defaultUserSettingsPath + ' to: ' + userSettingsPath);
  // Copy the default user settings file into user's directory.
  const data = fs.readFileSync(defaultUserSettingsPath);
  fs.writeFileSync(userSettingsPath, data);
}

/**
 * Loads the configuration settings for the user.
 *
 * @returns the key:value mapping of settings for the user.
 */
export function loadUserSettings(userId: string): common.UserSettings {
  var settingsPath = path.join(getUserConfigDir(userId), SETTINGS_FILE);
  if (!fs.existsSync(settingsPath)) {
    console.log('User settings file %s not found, copying default settings.', settingsPath);
    copyDefaultUserSettings(userId);
  }

  try {
    const settings = <common.UserSettings>JSON.parse(fs.readFileSync(settingsPath, 'utf8') || '{}');
    return settings;
  }
  catch (e) {
    console.log(e);
    return null;
  }
}

function ensureDirExists(fullPath: string): boolean {
  if (path.dirname(fullPath) == fullPath) {
    // This should only happen once we hit the root directory
    return true;
  }
  if (fs.existsSync(fullPath)) {
    if (!fs.lstatSync(fullPath).isDirectory()) {
      console.log('Path ' + fullPath + ' is not a directory');
      return false;
    }
    return true;
  }
  if (!ensureDirExists(path.dirname(fullPath))) {
    return false;
  }
  fs.mkdirSync(fullPath);
  return true;
}

/**
 * Updates a single configuration setting for the user.
 *
 * @param key the name of the setting to update.
 * @param value the updated value of the setting.
 * @returns true iff the update was applied.
 */
export function updateUserSetting(userId: string, key: string, value: string,
                                  asynchronous: boolean = false): boolean {
  var userDir = userManager.getUserDir(userId);
  var settingsDir =  path.join(userDir, 'datalab', '.config');
  var settingsPath = path.join(settingsDir, SETTINGS_FILE);

  if (!fs.existsSync(settingsPath)) {
    console.log('User settings file %s not found, copying default settings.', settingsPath);
    copyDefaultUserSettings(userId);
  }

  let settings: common.UserSettings;
  if (fs.existsSync(settingsPath)) {
    try {
      settings = <common.UserSettings>JSON.parse(fs.readFileSync(settingsPath, 'utf8') || '{}');
    }
    catch (e) {
      console.log(e);
      return false;
    }
  }
  settings[key] = value;

  try {
    var settingsString = JSON.stringify(settings);
    var writeFunc = asynchronous ? fs.writeFile : fs.writeFileSync;
    if (ensureDirExists(path.normalize(settingsDir))) {
      writeFunc(settingsPath, settingsString);
    }
  }
  catch (e) {
    console.log(e);
    return false;
  }
  return true;
}

/**
 * Implements setting update request handling.
 * @param request the incoming http request.
 * @param response the outgoing http response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  if (request.url.indexOf('/api/settings') === 0) {
    appSettingsHandler(request, response);
  } else {
    var userId = userManager.getUserId(request);
    if ('POST' == request.method) {
      postSettingsHandler(userId, request, response);
    } else {
      getSettingsHandler(userId, request, response);
    }
  }
}

/**
 * Handles app settings requests, returns the app settings JSON.
 * @param request the incoming http request.
 * @param response the outgoing http response.
 */
function appSettingsHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  const appSettings = loadAppSettings();
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(appSettings));
}

/**
 * Handles 'GET' requests to the settings handler.
 * @param request the incoming http request.
 * @param response the outgoing http response.
 */
function getSettingsHandler(userId: string, request: http.ServerRequest, response: http.ServerResponse): void {
  const userSettings = loadUserSettings(userId);
  const parsedUrl = url.parse(request.url, true);
  if ('key' in parsedUrl.query) {
    const key = parsedUrl.query['key'];
    if (key in userSettings) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(userSettings[key]));
    } else {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end();
    }
    return;
  } else {
    const visibleSettings = JSON.parse(JSON.stringify(userSettings));
    if (visibleSettings[IDLE_TIMEOUT_KEY] === undefined) {
      const appSettings = loadAppSettings();
      visibleSettings[IDLE_TIMEOUT_KEY] = appSettings[IDLE_TIMEOUT_KEY];
    }
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(visibleSettings));
    return;
  }
}

/**
 * Handles 'POST' requests to the settings handler.
 * @param request the incoming http request.
 * @param response the outgoing http response.
 */
function postSettingsHandler(userId: string, request: http.ServerRequest, response: http.ServerResponse): void {
  var formData : any;
  var body : string = "";
  request.on('data', function(chunk: string) { body += chunk; });
  request.on('end', function() {
    if (body) {
      formData = querystring.parse(body);
    } else {
      var parsedUrl = url.parse(request.url, true);
      formData = parsedUrl.query;
    }
    formHandler(userId, formData, request, response);
  });
}

/**
 * Handles updating a setting given the parsed form contents.
 * @param formData the form data parsed from the incoming http request.
 * @param request the incoming http request.
 * @param response the outgoing http response.
 */
function formHandler(userId: string, formData: any, request: http.ServerRequest, response: http.ServerResponse): void {
  if (!(('key' in formData) && ('value' in formData))) {
    response.writeHead(400, { 'Content-Type': 'text/plain' });
    response.end('Missing one or more required fields');
    return;
  }
  var key = formData['key'];
  var value = formData['value'];
  if (key == IDLE_TIMEOUT_KEY) {
    if (value) {
      const { seconds, errorMessage } = idleTimeout.parseAndValidateInterval(value);
      if (errorMessage) {
        response.writeHead(400, { 'Content-Type': 'text/plain' });
        response.end(errorMessage);
        return;
      }
    }
  }
  // If dryRun was set, we don't actually update anything.
  if ('dryRun' in formData) {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('dryRun');
    return;
  }
  if (updateUserSetting(userId, key, value)) {
    if ('redirect' in formData) {
      response.writeHead(302, { 'Location': formData['redirect'] });
    } else {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
    }
  } else {
    response.writeHead(500, { 'Content-Type': 'text/plain' });
  }
  response.end();
  if (key == IDLE_TIMEOUT_KEY) {
    idleTimeout.setIdleTimeoutInterval(value);
  }
  return;
}

/**
 * Creates the setting updater request handler.
 * @returns the request handler to handle setting update requests.
 */
export function createHandler(): http.RequestHandler {
  return requestHandler;
}
