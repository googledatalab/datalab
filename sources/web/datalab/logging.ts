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
/// <reference path="../../../third_party/externs/ts/node/bunyan.d.ts" />
/// <reference path="../../../third_party/externs/ts/node/mkdirp.d.ts" />
/// <reference path="common.d.ts" />

import bunyan = require('bunyan');
import fs = require('fs');
import http = require('http');
import mkdirp = require('mkdirp');
import path = require('path');
import uuid = require('node-uuid');

var logger: bunyan.ILogger = null;
var requestLogger: bunyan.ILogger = null;
var jupyterLogger: bunyan.ILogger = null;

/**
 * Gets the logger for generating debug logs.
 * @returns the logger configured for debugging logging.
 */
export function getLogger(): bunyan.ILogger {
  return logger;
}

/**
 * Logs a request and the corresponding response.
 * @param request the request to be logged.
 * @param response the response to be logged.
 */
export function logRequest(request: http.ServerRequest, response: http.ServerResponse): void {
  requestLogger.info({ url: request.url, method: request.method }, 'Received a new request');
  response.on('finish', function() {
    requestLogger.info({ url: request.url, method: request.method, status: response.statusCode });
  });
}

/**
 * Logs the output from Jupyter.
 * @param text the output text to log.
 * @param error whether the text is error text or not.
 */
export function logJupyterOutput(text: string, error: boolean): void {
  // All Jupyter output seems to be generated on stderr, so ignore the
  // error parameter, and log as info...
  jupyterLogger.info(text);
}

/**
 * Initializes loggers used within the application.
 */
export function initializeLoggers(settings: common.AppSettings): void {
  // Ensure the directory containing logs exists (as bunyan doesn't create the directory itself).
  var logFilePath = path.join(settings.datalabRoot, settings.logFilePath);
  mkdirp.sync(path.dirname(logFilePath));

  var streams: bunyan.LogStream[] = [
    { level: 'info', type: 'rotating-file',
      path: logFilePath, period: settings.logFilePeriod, count: settings.logFileCount }
  ];
  if (settings.consoleLogging) {
    streams.push({ level: settings.consoleLogLevel, type: 'stream', stream: process.stderr });
  }

  logger = bunyan.createLogger({ name: 'app', streams: streams });
  requestLogger = logger.child({ type: 'request' });
  jupyterLogger = logger.child({ type: 'jupyter' });
}
