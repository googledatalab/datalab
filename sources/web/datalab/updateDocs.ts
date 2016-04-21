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

/// <reference path="../../../externs/ts/node/node.d.ts" />
/// <reference path="common.d.ts" />

import childProcess = require('child_process');
import fs = require('fs');
import logging = require('./logging');
import path = require('path');


export function startUpdate(settings: common.Settings) {
  if (!settings.docsGcsPath) {
    return;
  }
  
  var docsSourceGcsPath: string = settings.docsGcsPath;
  if (docsSourceGcsPath.substr(docsSourceGcsPath.length - 1) != '/') {
    docsSourceGcsPath += '/';
  }
  docsSourceGcsPath += '*';

  var docsDownloadDir: string = '/tmp/datalabdocs';
  var docsDir: string = path.join(settings.contentDir, 'datalab/docs');
  if (fs.existsSync(docsDownloadDir)) {
    childProcess.execSync('rm -r -f ' + docsDownloadDir, {env: process.env});
  }
  fs.mkdirSync(docsDownloadDir);
  // TODO(gram): must replace this with a git clone.
  var downloadCommand = 'gsutil -m cp -r ' + docsSourceGcsPath + ' ' + docsDownloadDir;
  childProcess.exec(downloadCommand, {env: process.env}, function(err, stdout, stderr) {
    if (err) {
      logging.getLogger().error(err, 'Failed to download docs. stderr: %s', stderr);
      return;
    }
    childProcess.execSync('cp -r ' + docsDownloadDir + '/* ' + docsDir, {env: process.env});
    childProcess.execSync('rm -r -f ' + docsDownloadDir, {env: process.env});
  });
}
