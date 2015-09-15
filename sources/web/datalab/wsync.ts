/*
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express
 * or implied. See the License for the specific language governing permissions
 * and limitations under
 * the License.
 */

/// <reference path="../../../externs/ts/node/node.d.ts" />
/// <reference path="common.d.ts" />

import childProcess = require('child_process');
import fs = require('fs');
import logging = require('./logging');
import path = require('path');

var syncRequests: common.Map<number> = {};
var MIN_SYNC_INTERVAL: number = 10 * 1000;
var MAX_SYNC_RETRY: number = 30;

function runWsyncSync(userDir: string, repoUrl: string, cb: common.Callback<number>) {
  var wsyncSyncArgs = [
    '-credential_helper',
    'git-credential-gcloud.sh',
    'sync',
    '-file-strategy',
    'ours',
    '-repo',
    userDir,
    repoUrl
  ];
  var wsyncSyncProcess = childProcess.spawn('/wsync/wsync', wsyncSyncArgs, {env: process.env});
  wsyncSyncProcess.on('error', function(err: Error) {
    logging.getLogger().error(err, 'wsync sync failed.');
    cb && cb(err, -1);
  });
  wsyncSyncProcess.on('exit', function(code: number, signal: string) {
    if (code != 0) {
      logging.getLogger().error('wsync sync failed. code: %d. signal: %s. stderr: %s', code, signal, wsyncSyncProcess.stderr);
    }
    cb && cb(null, code);
  });
}

function runWsyncCheckoutAndSync(userDir: string, repoUrl: string, workspaceName: string, cb: common.Callback<number>) {
  var wsyncCheckoutArgs = [
    '-credential_helper',
    'git-credential-gcloud.sh',
    'checkout',
    '-repo',
    userDir,
    repoUrl,
    workspaceName
  ];
  var wsyncCheckoutProcess = childProcess.spawn('/wsync/wsync', wsyncCheckoutArgs, {env: process.env});
  wsyncCheckoutProcess.on('error', function(err: Error) {
    logging.getLogger().error(err, 'wsync checkout failed.');
    cb && cb(err, -1);
  });
  wsyncCheckoutProcess.on('exit', function(code: number, signal: string) {
    if (code != 0) {
      logging.getLogger().error('wsync checkout failed. code: %d. signal: %s. stderr: %s', code, signal, wsyncCheckoutProcess.stderr);
      cb && cb(null, code);
      return;
    }
    runWsyncSync(userDir, repoUrl, cb);
  });
}

function runEnsureDirAndSync(userDir: string, repoUrl: string, workspaceName: string, branch: string, cb: common.Callback<number>) {
  var gitCloneArgs = ['clone', '-b', branch, repoUrl, userDir];
  var gitProcess = childProcess.spawn('git', gitCloneArgs, {env: process.env});
  gitProcess.on('error', function(err: Error) {
    logging.getLogger().error(err, 'git clone failed.');
    cb && cb(err, -1);
  });
  gitProcess.on('exit', function(code: number, signal: string) {
    if (code != 0) {
      logging.getLogger().error('git clone failed. code: %d. signal: %s. stderr: %s', code, signal, gitProcess.stderr);
      cb && cb(null, code);
      return;
    }
    runWsyncCheckoutAndSync(userDir, repoUrl, workspaceName, cb);
  });
}

export function syncNow(email: string, contentRootDir: string, projectId: string, moduleVersion: string, cb: common.Callback<number>) {
  var repoUrl = 'https://source.developers.google.com/p/' + projectId;
  var userDir = path.join(contentRootDir, email);
  var branch = 'datalab_' + moduleVersion;
  var workspaceName = 'acropolis__' + email + '__' + branch;
  if (!fs.existsSync(userDir)) {
    runEnsureDirAndSync(userDir, repoUrl, workspaceName, branch, cb);
  } else {
    runWsyncSync(userDir, repoUrl, cb);
  }
}

export function scheduleSync(email: string, contentRootDir: string, projectId: string, moduleVersion: string) {
  if (!syncRequests[email]) {
    syncRequests[email] = 1;
  }
  setTimeout(function() {
    if (syncRequests[email] != null) {
      syncNow(email, contentRootDir, projectId, moduleVersion, 
        function(e, code) {
          if (code == 0) {
            delete syncRequests[email];
          } else {
            syncRequests[email] = syncRequests[email] + 1;
            if (syncRequests[email] < MAX_SYNC_RETRY) {
              logging.getLogger().info('Reschedule sync.');
              scheduleSync(email, contentRootDir, projectId, moduleVersion);
            } else {
              logging.getLogger().error('Sync has failed %d times. Give up.', MAX_SYNC_RETRY);
              delete syncRequests[email];
            }
          }
      });
    }
  }, MIN_SYNC_INTERVAL);
}
