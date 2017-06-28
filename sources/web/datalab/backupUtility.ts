/*
 * Copyright 2016 Google Inc. All rights reserved.
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
/// <reference path="common.d.ts" />

import childProcess = require('child_process');
import logging = require('./logging');
import path = require('path');
import fs = require('fs');

var appSettings: common.AppSettings;
var backupIntervalVar: number = null;
var backupLogPath: string = '';

// check for backups every 10 minutes so we can retry failed backups
const BACKUP_INTERVAL: number = 1000*60*10;

/**
 * Last successful backup timestamps are stored in a file to avoid unnecessary backups,
 * and also to compare current time against last time a successful backup ran
 */
function readBackupLog() {
  try {
    return JSON.parse(fs.readFileSync(backupLogPath, 'utf8'));
  } catch (err) {
    return {};
  }
}
function writeBackupLog(log_history: Object) {
  return fs.writeFileSync(backupLogPath, JSON.stringify(log_history), { encoding: 'utf8'});
}

/**
 * Run the GCSbackup shell script and call the callback function with its exit code
 */
function runBackup(tag: string, callback: Function) {
  var cmd = childProcess.spawn('/bin/bash', ['/datalab/GCSbackup.sh',
                               '-t', tag,
                               '-p', '/content',
                               '-l', '/datalab/.backup_log.txt']);
  cmd.on('close', (code: number) => {
    if (code > 0) {
      logging.getLogger().error('WARNING: Backup script with tag ' + tag + ' failed with code: ' + code);
    } else {
      callback();
    }
  });
}

/**
 * Start a periodic backup process by calling the GCSbackup shell script
 * every hour, day, and week. Compare against the last time each backup
 * ran to catch up if we missed any backups (e.g. because Datalab wasn't running)
 */
export function startBackup(settings: common.AppSettings) {
  appSettings = settings;
  backupLogPath = path.join(appSettings.datalabRoot, '/datalab/.backup_history');

  if (!backupIntervalVar && settings.enableAutoGCSBackups) {
    var num_hourly = settings.numHourlyBackups;
    var num_daily = settings.numDailyBackups;
    var num_weekly = settings.numWeeklyBackups;

    backupIntervalVar = global.setInterval(() => {
      var log_history = readBackupLog();
      // test hourly backup
      if (!log_history.lastHourlyRun || (Date.now()-log_history.lastHourlyRun)/1000 > 60*60) {
        runBackup('hourly', () => {
          log_history.lastHourlyRun = Date.now();
          writeBackupLog(log_history);
        });
      }
      if (!log_history.lastDailyRun || (Date.now()-log_history.lastDailyRun)/1000 > 60*60*24) {
        runBackup('daily', () => {
          log_history.lastDailyRun = Date.now();
          writeBackupLog(log_history);
        });
      }
      if (!log_history.lastWeeklyRun || (Date.now()-log_history.lastWeeklyRun)/1000 > 60*60*24*7) {
        runBackup('weekly', () => {
          log_history.lastWeeklyRun = Date.now();
          writeBackupLog(log_history);
        });
      }

    }, BACKUP_INTERVAL);
  }
}
