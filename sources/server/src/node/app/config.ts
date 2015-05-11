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
/// <reference path="../../../../../externs/ts/node/mkdirp-async.d.ts" />
/// <reference path="../../../../../externs/ts/node/gcloud.d.ts" />
/// <reference path="./common/interfaces.d.ts" />
import content = require('./storage/index');
import express = require('express');
import gcloud = require('gcloud');
import gcp = require('./common/gcp');
import kernels = require('./kernels/index');
import mkdirp = require('mkdirp');
import nbstorage = require('./notebooks/storage');
import sessions = require('./sessions/index');


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
var _kernelManager: app.IKernelManager;

/**
 * Gets the kernel manager singleton.
 */
export function getKernelManager(): app.IKernelManager {
  return _kernelManager;
}

/**
 * A single stateless server-wide notebook storage backend instance.
 */
var _notebookStorage: app.INotebookStorage;

export function initKernelManager(ipythonKernelConfigPath: string) {
  if (_kernelManager) {
    // Kernel manager already initialized.
    return;
  }

  _kernelManager = new kernels.Manager(ipythonKernelConfigPath);
}

/**
 * Gets the configured notebook storage backend for persisting notebooks.
 */
export function getNotebookStorage(): app.INotebookStorage {
  return _notebookStorage;
}

/**
 * A single stateless server-wide storage backend instance.
 */
var _storage: app.IStorage;

/**
 * Gets a storage backend for persisting server content.
 */
export function getStorage(): app.IStorage {
  return _storage;
}

/**
 * Asynchronously initializes the storage system for reading/writing.
 *
 * Takes storage configuration options and selects an appropriate storage backend.
 *
 * Precedence:
 * - cloud project storage (highest)
 * - user-specified GCS bucket
 * - local filesystem (lowest)
 *
 * @param notebookStoragePath Local filesystem path to use for storage.
 * @param bucket GCS bucket to use for storage.
 * @param useCloudProjectStorage Boolean to use project-associated cloud storage.
 * @param callback Completion callback to invoke once storage is initialized.
 */
export function initStorage(
    notebookStoragePath: string,
    bucket: string,
    useCloudProjectStorage: boolean,
    callback: app.Callback<void>
    ): void {

  // Define common callback for initializing the notebook storage.
  var initNotebookStorageThenCallback = (error: Error) => {
    if (error) {
      callback(error);
      return;
    }

    initNotebookStorage();
    callback(null);
  };

  if (_storage) {
    // Already initialized storage.
    process.nextTick(initNotebookStorageThenCallback.bind(null, null));
    return;
  }

  // Select a storage backend based upon the specified arguments.
  if (useCloudProjectStorage) {
    initCloudProjectStorage(initNotebookStorageThenCallback);
  } else if (bucket) {
    // Then use GCS for storage.
    initGcsStorage(bucket, initNotebookStorageThenCallback);
  } else {
    // Then use the local file system for storage.
    initLocalFileSystemStorage(notebookStoragePath, initNotebookStorageThenCallback);
  }
}

function initNotebookStorage() {
  // Create the notebook storage singleton if it hasn't yet been created
  if (!_notebookStorage) {
     _notebookStorage = new nbstorage.NotebookStorage(_storage);
  }
}

function initCloudProjectStorage(callback: app.Callback<void>) {
  // Get the project-associated GCS bucket.
  gcp.getProjectStorageBucket((error, projectBucket) => {
    if (error) {
      callback(error);
      return;
    }

    initGcsStorage(projectBucket, callback);
  });
}

function initGcsStorage(bucket: string, callback: app.Callback<void>) {
  // Initialize the GCS storage instance.
  var client = gcloud.storage().bucket(bucket);

  console.log('Using GCS storage. Bucket: ', bucket);
  _storage = new content.GoogleCloudStorage(client);

  callback(null);
}

function initLocalFileSystemStorage(notebookStoragePath: string, callback: app.Callback<void>) {
  // Ensure that the notebook storage path exists.
  mkdirp(notebookStoragePath, (error: Error) => {
    if (error) {
      callback(error);
      return;
    }

    console.log('Using local storage. Root notebook storage path: ', notebookStoragePath);
    _storage = new content.LocalFileSystem(notebookStoragePath);

    callback(null);
  });
}
