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
import express = require('express');
import kernels = require('./kernels/api');
import manager = require('./kernels/manager');


/**
 * Default server configuration with support for environment variable overrides.
 */
var settings: app.Settings = {
  httpPort: parseInt(process.env['SERVER_HTTP_PORT'] || 8080)
};

export function getSettings (): app.Settings {
  return settings;
}

/**
 * A single, server-wide kernel manager instance
 */
var kernelManager: app.IKernelManager = new manager.KernelManager();

/**
 * Gets the kernel manager singleton
 */
export function getKernelManager (): app.IKernelManager {
  return kernelManager;
}

/**
 * Gets the set of HTTP API route handlers that should be enabled for the server.
 */
export function getApiRouter (): express.Router {
  var kernelApi = new kernels.KernelApi(kernelManager);
  var apiRouter: express.Router = express.Router();
  kernelApi.register(apiRouter);
  // TODO(bryantd): register notebooks/datasets/other APIs here eventually

  return apiRouter;
}
