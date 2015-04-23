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


/// <reference path="../../../../../externs/ts/express/express.d.ts" />
/// <reference path="../../../../../externs/ts/node/mkdirp.d.ts" />
/// <reference path="./common/interfaces.d.ts" />
import express = require('express');
import mkdirp = require('mkdirp');
import kernels = require('./kernels/index');
import content = require('./storage/index');
import sessions = require('./sessions/index');
import nbstorage = require('./notebooks/storage');


/**
 * Gets the set of HTTP API route handlers that should be enabled for the server.
 */
export function getApiRouter(
    storage: app.IStorage,
    kernelManager: app.IKernelManager,
    sessionManager: app.ISessionManager
    ): express.Router {

  var apiRouter: express.Router = express.Router();

  var contentApi = new content.Api(storage);
  contentApi.register(apiRouter);

  var kernelApi = new kernels.Api(kernelManager);
  kernelApi.register(apiRouter);

  var sessionsApi = new sessions.Api(sessionManager);
  sessionsApi.register(apiRouter);

  return apiRouter;
}

/**
 * Default server configuration with support for environment variable overrides.
 *
 * TODO(bryantd): This should be configured from an external settings file eventually.
 */
var _settings: app.Settings = {
  httpPort: parseInt(process.env['SERVER_HTTP_PORT'] || 9000)
};

/**
 * Gets the configurable settings.
 */
export function getSettings(): app.Settings {
  return _settings;
}

/**
 * A single, server-wide kernel manager instance.
 */
var _kernelManager: app.IKernelManager = new kernels.Manager();

/**
 * Gets the kernel manager singleton.
 */
export function getKernelManager(): app.IKernelManager {
  return _kernelManager;
}

/**
 * A single stateless server-wide storage backend instance.
 */
var _fsStorage: app.IStorage;

/**
 * Gets the configured storage backend for persisting arbitrary content.
 */
export function getStorage(): app.IStorage {
  return _fsStorage;
}

/**
 * A single stateless server-wide notebook storage backend instance.
 */
var _notebookStorage: app.INotebookStorage;

/**
 * Gets the configured notebook storage backend for persisting notebooks.
 */
export function getNotebookStorage(): app.INotebookStorage {
  return _notebookStorage;
}

/**
 * Initializes the storage system for reading/writing.
 */
export function initStorage(notebookStoragePath: string) {
  // Ensure that the notebook storage path exists.
  mkdirp.sync(notebookStoragePath);
  console.log('Root notebook storage path: ', notebookStoragePath);

  // Create the storage singleton if it hasn't been created before.
  if (!_fsStorage) {
    _fsStorage = new content.LocalFileSystem(notebookStoragePath);
  }

  // Create the notebook storage singleton if it hasn't yet been created
  if (!_notebookStorage) {
     _notebookStorage = new nbstorage.NotebookStorage(_fsStorage);
  }
}
