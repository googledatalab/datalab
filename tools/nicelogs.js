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

// This tool can be used to pipe in JSON logs produced by the datalab
// application server to generate nicely formatted and colorized log
// display.
// For example:
// tail -f logs_file | node nicelogs.js

'use strict';

var readline = require('readline'),
    util = require('util');

var colors = {
  white: function(s) { return util.format('\x1b[37m%s\x1b[0m', s); },
  green: function(s) { return util.format('\x1b[32m%s\x1b[0m', s); },
  yellow: function(s) { return util.format('\x1b[33m%s\x1b[0m', s); },
  red: function(s) { return util.format('\x1b[31m%s\x1b[0m', s); },
  dim: function(s) { return util.format('\x1b[2m%s\x1b[0m', s); }
}

var levelMap = {
  '10': { name: 'TRACE', color: colors.white },
  '20': { name: 'DEBUG', color: colors.white },
  '30': { name: 'INFO ', color: colors.green },
  '40': { name: 'WARN ', color: colors.yellow },
  '50': { name: 'ERROR', color: colors.red },
  '60': { name: 'FATAL', color: colors.red }
};

function outputLog(logLine) {
  var log = null;
  try {
    log = JSON.parse(logLine);
  }
  catch (e) {
    console.log(colors.dim(logLine));
    return;
  }

  var timestamp = new Date(log.time).toLocaleTimeString();

  if (log.type == 'request') {
    logLine = util.format('%s %s %s [%d]',
                          timestamp, log.method, log.url, log.status);
    if (log.status >= 500) {
      console.log(colors.red(logLine));
    }
    else if (log.status >= 400) {
      console.log(colors.yellow(logLine));
    }
    else {
      console.log(colors.green(logLine));
    }
  }
  else if (log.type == 'ipython') {
    logLine = util.format('%s ...', timestamp);
    console.log(colors.white(logLine));
    console.log(colors.dim(log.msg.trim()));
  }
  else {
    var level = levelMap[log.level.toString()] || levelMap['10'];

    logLine = util.format('%s %s %s', timestamp, level.name, log.msg.trim());
    console.log(level.color(logLine));
  }
}


var readerOptions = {
  input: process.stdin
};
readline.createInterface(readerOptions).
  on('line', function(line) {
    outputLog(line);
  }).
  on('close', function() {
    process.exit(0);
  });
