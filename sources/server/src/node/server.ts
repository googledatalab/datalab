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


/// <reference path="../../../../externs/ts/express/body-parser.d.ts" />
/// <reference path="../../../../externs/ts/express/express.d.ts" />
/// <reference path="../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../externs/ts/node/nomnom.d.ts" />
/// <reference path="../../../../externs/ts/node/socket.io.d.ts" />
/// <reference path="../../../../externs/ts/node/winston.d.ts" />
import bodyParser = require('body-parser');
import config = require('./app/config');
import express = require('express');
import http = require('http');
import logging = require('./app/common/logging');
import msgproc = require('./app/sessions/messageprocessors');
import nomnom = require('nomnom');
import sessions = require('./app/sessions/manager');
import socketio = require('socket.io');

/**
 * Configure and parse command line arguments with defaults.
 */
var options = nomnom
  .option('notebookPath', {
    abbr: 'n',
    full: 'notebook-path',
    help: 'notebook loading root path',
    default: './notebooks'
  })
  .option('gcsStorageBucket', {
    abbr: 'b',
    full: 'bucket',
    help: 'GCS storage bucket to use for server content'
  })
  .option('ipythonKernelConfigPath', {
    full: 'ipy-config',
    help: 'IPython kernel configuration file path'
  })
  .option('cloudProjectStorage', {
    abbr: 'c',
    full: 'cloud-project',
    flag: true,
    help: 'Use the notebook storage associated with a GCP cloud project'
  })
  .option('logLevel', {
    full: 'log-level',
    help: 'Logging level: debug, info, warn, error',
    default: 'info'
  })
  .option('logDir', {
    full: 'log-dirpath',
    help: 'Directory in which to output log files'
  })
  .option('logFile', {
    full: 'log-file',
    help: 'Log filename prefix.',
    default: 'datalab'
  })
  .parse();

logging.configure(options.logLevel, options.logDir, options.logFile);
var logger = logging.getLogger();

/**
 * Main entry point for the server.
 *
 * Starts an HTTP server on port that can be overridden by environment variable defined in
 * app.Settings (see: app/config)
 *
 * Initializes the messaging system to listen for incoming user connections via socket.io
 */
export function start (settings: app.Settings) {
  var expressApp = express();
  var httpServer = http.createServer(expressApp);

  var sessionManager = new sessions.SessionManager(
    config.getKernelManager(),
    msgproc.getMessageProcessors(),
    config.getNotebookStorage(),
    socketio.listen(httpServer)
  );

  // Configure express to parse request bodies as JSON for the "application/json" MIME type.
  expressApp.use(bodyParser.json());

  // Define the API route handlers.
  expressApp.use('/api', config.getApiRouter(
      config.getStorage(),
      config.getKernelManager(),
      sessionManager));

  // Configure express to serve the static UI content.
  expressApp.use(express.static(__dirname + '/static'));

  logger.info('Starting HTTP server on port %s', settings.httpPort);
  httpServer.listen(settings.httpPort);
}


// Ensure that the notebook storage system is fully initialized.
config.initStorage(
    options.notebookPath,
    options.gcsStorageBucket,
    options.cloudProjectStorage,
    (error, callback) => {

  if (error) {
    // Storage init failed. Do not start server.
    logger.error('Aborting server startup due to error during storage initialization', error);
    return;
  }
  logger.info('Storage configured');

  // Initialize the kernel manager with additional configuration.
  config.initKernelManager(options.ipythonKernelConfigPath);

  // Start the DataLab server running.
  start(config.getSettings());
});
