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
/// <reference path="../../../third_party/externs/ts/node/node-http-proxy.d.ts" />
/// <reference path="common.d.ts" />

import fs = require('fs');
import http = require('http');
import path = require('path');
import url = require('url');
import logging = require('./logging');
import settings = require('./settings');
import userManager = require('./userManager');

let appSettings: common.AppSettings;
const CONTENT_TYPES: common.Map<string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
};
const CUSTOM_THEME_FILE = 'custom.css';
const DEFAULT_THEME_FILE = 'light.css';

const contentCache: common.Map<Buffer> = {};
const watchedDynamicContent: common.Map<boolean> = {};

// Path to use for fetching static resources provided by Jupyter.
function jupyterDir(): string {
  const prefix = appSettings.datalabRoot || '/usr/local/envs/py3env/lib/python3.5';
  return path.join(prefix, '/site-packages/notebook');
}

function getContent(filePath: string, cb: common.Callback<Buffer>, isDynamic: boolean = false): void {
  const content = contentCache[filePath];
  if (content != null) {
    process.nextTick(() => {
      cb(null, content);
    });
  } else {
    fs.readFile(filePath, (error, fileContent) => {
      if (error) {
        cb(error, null);
      } else {
        if (isDynamic && !watchedDynamicContent[filePath]) {
          fs.watch(filePath, (eventType, filename) => {
            logging.getLogger().info('Clearing cache for updated file: %s', filePath);
            contentCache[filePath] = null;
            if (eventType === 'rename') {
              watchedDynamicContent[filePath] = false;
            }
          });
          watchedDynamicContent[filePath] = true;
        }
        contentCache[filePath] = fileContent;
        cb(null, fileContent);
      }
    });
  }
}

/**
 * Sends a static file as the response.
 * @param filePath the full path of the static file to send.
 * @param response the out-going response associated with the current HTTP request.
 * @param alternatePath the path to a static Datalab file to send if the given file is missing.
 * @param isDynamic indication of whether or not the file contents might change.
 */
function sendFile(filePath: string, response: http.ServerResponse,
                  alternatePath = '', isDynamic = false,
                  replaceBasepath = false): void {
  const extension = path.extname(filePath);
  const contentType = CONTENT_TYPES[extension.toLowerCase()] || 'application/octet-stream';

  getContent(filePath, (error, content) => {
    if (error) {
      logging.getLogger().error(error, 'Unable to send static file: %s', filePath);

      if (alternatePath !== '') {
        sendDataLabFile(alternatePath, response);
      } else {
        response.writeHead(500);
        response.end();
      }
    } else {
      if (isDynamic) {
        response.removeHeader('Cache-Control');
        response.setHeader('Cache-Control', 'no-cache');
      }
      response.writeHead(200, { 'Content-Type': contentType });
      if (replaceBasepath) {
        const contentStr = content.toString().replace(
            /\{base_url}/g, appSettings.datalabBasePath);
        response.end(contentStr);
      } else {
        response.end(content);
      }
    }
  }, isDynamic);
}

/**
 * Sends a static file located within the DataLab static directory.
 * @param filePath the relative file path of the static file to send.
 * @param response the out-going response associated with the current HTTP request.
 * @param isDynamic indication of whether or not the file contents might change.
 */
function sendDataLabFile(filePath: string, response: http.ServerResponse,
    isDynamic = false, replaceBasepath = false): void {
  let live = isDynamic;
  let staticDir = path.join(__dirname, 'static');
  // Set this env var to point to source directory for live updates without restart.
  const liveStaticDir = process.env.DATALAB_LIVE_STATIC_DIR;
  if (liveStaticDir) {
    live = true;
    staticDir = liveStaticDir;
  }
  sendFile(path.join(staticDir, filePath), response, '', live, replaceBasepath);
}

/**
 * Sends a static file located within the Jupyter install.
 * @param filePath the relative file path of the static file within the Jupyter directory to send.
 * @param response the out-going response associated with the current HTTP request.
 */
function sendJupyterFile(relativePath: string, response: http.ServerResponse): void {
  const filePath = path.join(jupyterDir(), relativePath);
  fs.stat(filePath, (e, stats) => {
    if (e || !stats.isFile()) {
      response.writeHead(404);
      response.end();
      return;
    }

    sendFile(filePath, response);
  });
}

/**
 * Checks whether a requested static file exists in DataLab.
 * @param filePath the relative path of the file.
 */
export function datalabFileExists(filePath: string): boolean {
  return fs.existsSync(path.join(__dirname, 'static', filePath));
}

/**
 * Sends a static 'custom.css' file located within the user's config directory.
 *
 * @param userId the ID of the current user.
 * @param response the out-going response associated with the current HTTP request.
 */
function sendUserCustomTheme(userId: string, response: http.ServerResponse): void {
  const customThemePath = path.join(settings.getUserConfigDir(userId), CUSTOM_THEME_FILE);
  sendFile(customThemePath, response, DEFAULT_THEME_FILE, true);
}

/**
 * Returns true if this path should return an experimental UI resource
 * @param path the incoming request path
 */
export function isExperimentalResource(pathname: string, search: string): boolean {
  if (pathname.indexOf('/exp/') === 0) {
    return true;
  }
  const experimentalUiEnabled = process.env.DATALAB_EXPERIMENTAL_UI;
  return experimentalUiEnabled === 'true' && (
      firstComponent(pathname) === 'data' ||
      // /files/path?download=true is used to download files from Jupyter
      // TODO: use a different API to download files when we have a content service.
      (firstComponent(pathname) === 'files' && search !== '?download=true') ||
      firstComponent(pathname) === 'sessions' ||
      firstComponent(pathname) === 'terminal' ||
      firstComponent(pathname) === 'docs' ||
      firstComponent(pathname) === 'editor' ||
      firstComponent(pathname) === 'notebook' ||
      pathname.indexOf('/notebook.js') === 0 ||
      firstComponent(pathname) === 'bower_components' ||
      firstComponent(pathname) === 'components' ||
      firstComponent(pathname) === 'images' ||
      pathname.indexOf('/index.css') === 0 ||
      firstComponent(pathname) === 'modules' ||
      firstComponent(pathname) === 'templates' ||
      pathname === '/'
  );
}

/**
 * Parses the given url path and returns the first component.
 */
function firstComponent(pathname: string): string {
  return pathname.split('/')[1];
}

/**
 * Implements static file handling.
 * @param request the incoming file request.
 * @param response the outgoing file response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  let pathname = url.parse(request.url).pathname;
  const search = url.parse(request.url).search;

  // -------------------------------- start of experimental UI resources
  let replaceBasepath = false;
  // List of page names that resolve to index.html
  const indexPageNames = ['data', 'files', 'docs', 'sessions', 'terminal'];
  if (isExperimentalResource(pathname, search)) {
    logging.getLogger().debug('Serving experimental UI resource: ' + pathname);
    let rootRedirect = 'files';
    if (pathname.indexOf('/exp/') === 0) {
      pathname = pathname.substr('/exp'.length);
      rootRedirect = 'exp/files';
    }
    if (pathname === '/') {
      response.statusCode = 302;
      response.setHeader('Location', path.join(appSettings.datalabBasePath, rootRedirect));
      response.end();
      return;
    } else if (indexPageNames.indexOf(firstComponent(pathname)) > -1) {
      pathname = '/index.html';
      replaceBasepath = true;
    } else if (firstComponent(pathname) === 'editor') {
      pathname = '/editor.html';
      replaceBasepath = true;
    } else if (firstComponent(pathname) === 'notebook') {
      pathname = '/notebook.html';
      replaceBasepath = true;
    } else if (pathname === '/index.css') {
      const userSettings: common.UserSettings =
          settings.loadUserSettings(userManager.getUserId(request));
      pathname = '/index.' + (userSettings.theme || 'light') + '.css';
    }
    pathname = 'experimental' + pathname;
    logging.getLogger().debug('sending experimental file: ' + pathname);
    sendDataLabFile(pathname, response, undefined, replaceBasepath);
    return;
  }
  // -------------------------------- end of experimental resources

  console.log('static request: ' + pathname);
  // List of resources that are passed through with the same name.
  const staticResourcesList: string[] = [
    'appbar.html',
    'appbar.js',
    'util.js',
    'edit-app.js',
    'datalab.css',
    'idle-timeout.js',
    'minitoolbar.js',
    'notebook-app.js',
    'notebook-list.js',
    'reporting.html',
    'settings.html',
    'settings.js',
    'websocket.js',
  ];
  // Map of resources where we change the name.
  const staticResourcesMap: {[key: string]: string} = {
    'about.txt': 'datalab.txt',
    'favicon.ico': 'datalab.ico',
    'logo.png': 'datalab.png',
  };

  response.setHeader('Cache-Control', 'public, max-age=3600');
  const subpath = pathname.substr(pathname.lastIndexOf('/') + 1);
  if (staticResourcesList.indexOf(subpath) >= 0) {
    sendDataLabFile(subpath, response);
  } else if (subpath in staticResourcesMap) {
    sendDataLabFile(staticResourcesMap[subpath], response);
  } else if (pathname.indexOf('/codemirror/mode/') > 0) {
    const split = pathname.lastIndexOf('/');
    const newPath = 'codemirror/mode/' + pathname.substring(split + 1);
    if (datalabFileExists(newPath)) {
      sendDataLabFile(newPath, response);
    } else {
      // load codemirror modes from proper path
      pathname = pathname.substr(1).replace('static/codemirror', 'static/components/codemirror');
      sendJupyterFile(pathname, response);
    }
  } else if (pathname.lastIndexOf('/custom.js') >= 0) {
    // NOTE: Uncomment to use external content mapped into the container.
    //       This is only useful when actively developing the content itself.
    // var text = fs.readFileSync('/sources/datalab/static/datalab.js', { encoding: 'utf8' });
    // response.writeHead(200, { 'Content-Type': 'text/javascript' });
    // response.end(text);

    sendDataLabFile('datalab.js', response);
  } else if (pathname.lastIndexOf('/custom.css') > 0) {
    const userId = userManager.getUserId(request);
    const userSettings = settings.loadUserSettings(userId);
    if ('theme' in userSettings) {
      const theme = userSettings['theme'];
      if (theme === 'custom') {
        sendUserCustomTheme(userId, response);
      } else if (theme === 'dark') {
        sendDataLabFile('dark.css', response, true);
      } else {
        sendDataLabFile('light.css', response, true);
      }
    } else {
      sendDataLabFile(DEFAULT_THEME_FILE, response, true);
    }
  } else if ((pathname.indexOf('/static/extensions/') === 0) ||
           (pathname.indexOf('/static/require/') === 0) ||
           (pathname.indexOf('/static/fonts/') === 0)) {
    // Strip off the leading '/static/' to turn pathname into a relative path within the
    // static directory.
    sendDataLabFile(pathname.substr('/static/'.length), response);
  } else {
    // Strip off the leading slash to turn pathname into a relative file path
    sendJupyterFile(pathname.substr(1), response);
  }
}

/**
 * Creates the static content request handler.
 * @param handlerSettings configuration settings for the application.
 * @returns the request handler to handle static requests.
 */
export function createHandler(handlerSettings: common.AppSettings): http.RequestHandler {
  appSettings = handlerSettings;
  return requestHandler;
}
