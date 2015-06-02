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


/// <reference path="../../../../../../externs/ts/node/node.d.ts" />
/// <reference path="../../../../../../externs/ts/node/winston.d.ts" />
import path = require('path')
import util = require('util');
import winston = require('winston');

/**
 * Configures the server-wide logging system.
 *
 * @param logLevel Minimum log level to write (debug = log everything).
 * @param logDir Directory path in to which log files should be written.
 * @param logFile Filepath prefix for log files.
 */
export function configure(logLevel: string, logDir: string, logFile: string) {
  // Console logger.
  var consoleConfig: winston.ConsoleConfig = {
    timestamp: true,
    colorize: true,
    prettyPrint: true,
    level: logLevel,
  };
  if (logLevel == 'debug') {
    consoleConfig.debugStdout = true;
  }
  // Note: not possible to configure the default logger directly. Must remove/add it.
  winston.remove(winston.transports.Console);
  winston.add(winston.transports.Console, consoleConfig);

  // Rotating file logger.
  var filepath = logDir ? path.join(logDir, logFile) : logFile;
  var fileConfig: winston.DailyRotateFileConfig = {
    filename: filepath,
    datePattern: '.yyyy-MM-dd.log.json',
    maxFiles: 7,

    timestamp: true,
    colorize: false,
    prettyPrint: false,
    level: logLevel,

    handleExceptions: true,
    exitOnError: false,
  };
  winston.add(winston.transports.DailyRotateFile, fileConfig);

  winston.info('Writing logs to %s', filepath);
}

var defaultLogger: app.ILogger = {
  error: function(message: string, ...params: any[]) {
    this._log('error', message, params);
  },

  warn: function(message: string, ...params: any[]) {
    this._log('warn', message, params);
  },

  info: function(message: string, ...params: any[]) {
    this._log('info', message, params);
  },

  debug: function(message: string, ...params: any[]) {
    this._log('debug', message, params);
  },

  _log: function(level: string, message: string, params: any[]) {
    params.unshift(message);
    winston.log(level, util.format.apply(null, params));
  }
}

/**
 * Gets a logger instance.
 *
 * TODO(bryantd): Support configurable logger scopes eventually. For now a single global logger.
 *
 * @return Logger instance.
 */
export function getLogger(): app.ILogger {
  return defaultLogger;
}
