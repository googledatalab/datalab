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

/// <reference path="../../../externs/ts/node/node.d.ts" />
/// <reference path="common.d.ts" />

import callbacks = require('./callbacks');
import childProcess = require('child_process');
import fs = require('fs');
import logging = require('./logging');
import path = require('path');
import user = require('./user');

var MIN_SYNC_INTERVAL: number = 60 * 1000;
var MAX_SYNC_RETRY: number = 30;

var syncRequests: common.Map<number> = {};
var branchName: string = null;
var repoUrl: string = null;
var contentRootDir: string = null;

function runWsyncSync(userDir: string, repoUrl: string,
                      cb: common.Callback<number>) {
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
  var wsyncSyncProcess =
      childProcess.spawn('/wsync/wsync', wsyncSyncArgs, {env: process.env});
  wsyncSyncProcess.on('error', function(err: Error) {
    logging.getLogger().error(err, 'wsync sync failed.');
    cb && cb(err, -1);
  });
  wsyncSyncProcess.on('exit', function(code: number, signal: string) {
    if (code != 0) {
      logging.getLogger().error(
          'wsync sync failed. code: %d. signal: %s. stderr: %s', code, signal,
          wsyncSyncProcess.stderr);
    }
    cb && cb(null, code);
  });
}

function runWsyncCheckoutAndSync(userDir: string, repoUrl: string,
                                 workspaceName: string,
                                 cb: common.Callback<number>) {
  var wsyncCheckoutArgs = [
    '-credential_helper',
    'git-credential-gcloud.sh',
    'checkout',
    '-repo',
    userDir,
    repoUrl,
    workspaceName
  ];
  var wsyncCheckoutProcess =
      childProcess.spawn('/wsync/wsync', wsyncCheckoutArgs, {env: process.env});
  wsyncCheckoutProcess.on('error', function(err: Error) {
    logging.getLogger().error(err, 'wsync checkout failed.');
    cb && cb(err, -1);
  });
  wsyncCheckoutProcess.on('exit', function(code: number, signal: string) {
    if (code != 0) {
      logging.getLogger().error(
          'wsync checkout failed. code: %d. signal: %s. stderr: %s', code,
          signal, wsyncCheckoutProcess.stderr);
      cb && cb(null, code);
      return;
    }
    runWsyncSync(userDir, repoUrl, cb);
  });
}

function runEnsureDirAndSync(userDir: string, repoUrl: string,
                             workspaceName: string, branch: string,
                             cb: common.Callback<number>) {
  var gitCloneArgs = ['clone', '-b', branch, repoUrl, userDir];
  var gitProcess = childProcess.spawn('git', gitCloneArgs, {env: process.env});
  gitProcess.on('error', function(err: Error) {
    logging.getLogger().error(err, 'git clone failed.');
    cb && cb(err, -1);
  });
  gitProcess.on('exit', function(code: number, signal: string) {
    if (code != 0) {
      logging.getLogger().error(
          'git clone failed. code: %d. signal: %s. stderr: %s', code, signal,
          gitProcess.stderr);
      cb && cb(null, code);
      return;
    }
    runWsyncCheckoutAndSync(userDir, repoUrl, workspaceName, cb);
  });
}

export function init(settings: common.Settings): void {
  branchName = 'datalab_' + settings.instanceName;
  repoUrl = 'https://source.developers.google.com/p/' + settings.projectId;
  contentRootDir = settings.contentDir;
}

export function workspaceInitialized(userId: string): boolean {
  var userDir = user.getUserDir(userId);
  return fs.existsSync(userDir) && fs.readdirSync(userDir).length > 0;
}

export function syncNow(userId: string, cb: common.Callback<number>) {
  var userDir = user.getUserDir(userId);
  if (!callbacks.checkAndRegisterCallback(userId, 'wsync', cb)) {
    return;
  }
  var userDir = user.getUserDir(userId);
  if (fs.existsSync(userDir) && fs.readdirSync(userDir).length > 0) {
    runWsyncSync(userDir, repoUrl, function(e, code) {
      callbacks.invokeAllCallbacks(userId, 'wsync', e, code);
    });
    return;
  }
  var workspaceName = 'acropolis__' + userId + '__' + branchName;
  runEnsureDirAndSync(userDir, repoUrl, workspaceName, branchName, function(e, code) {
    callbacks.invokeAllCallbacks(userId, 'wsync', e, code);
  });
}

export function scheduleSync(userId: string) {
  if (syncRequests[userId]) {
    // A sync request is already scheduled.
    return;
  }
  syncRequests[userId] = 1;
  setTimeout(function() {
    syncNow(userId, function(e, code) {
      if (e == null) {
        delete syncRequests[userId];
      } else {
        syncRequests[userId] = syncRequests[userId] + 1;
        if (syncRequests[userId] < MAX_SYNC_RETRY) {
          logging.getLogger().info('Reschedule sync.');
          scheduleSync(userId);
        } else {
          logging.getLogger().error('Sync has failed %d times. Give up.',
                                    MAX_SYNC_RETRY);
          delete syncRequests[userId];
        }
      }
    });
  }, MIN_SYNC_INTERVAL);
}
