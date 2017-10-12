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
/// <reference path="../../../third_party/externs/ts/request/request.d.ts" />
/// <reference path="common.d.ts" />

import auth = require('./auth')
import fs = require('fs');
import health = require('./health');
import http = require('http');
import info = require('./info');
import jupyter = require('./jupyter');
import logging = require('./logging');
import idleTimeout = require('./idleTimeout');
import fileSearch = require('./fileSearch');
import metadata = require('./metadata');
import net = require('net');
import noCacheContent = require('./noCacheContent')
import path = require('path');
import request = require('request');
import reverseProxy = require('./reverseProxy');
import settings_ = require('./settings');
import sockets = require('./sockets');
import static_ = require('./static');
import url = require('url');
import userManager = require('./userManager');
import wsHttpProxy = require('./wsHttpProxy');
import backupUtility = require('./backupUtility');
import childProcess = require('child_process');

var server: http.Server;
var metadataHandler: http.RequestHandler;
var healthHandler: http.RequestHandler;
var infoHandler: http.RequestHandler;
var settingHandler: http.RequestHandler;
var staticHandler: http.RequestHandler;
var fileSearchHandler: http.RequestHandler;
var timeoutHandler: http.RequestHandler;

/**
 * The application settings instance.
 */
var appSettings: common.AppSettings;
var loadedSettings: common.UserSettings = null;

/**
 * If it is the user's first request since the web server restarts,
 * need to start jupyter server for that user.
 * We don't track results here. Later requests will go through initialization
 * checks again, and if it is still initializing, those requests will be parked
 * and wait for initialization to complete or fail.
 */
function startInitializationForUser(request: http.ServerRequest): void {
  if (jupyter.getPort(request) == 0) {
    var userId = userManager.getUserId(request);
    // Giving null callback so this is fire-and-forget.
    jupyter.startForUser(userId, null);
  }
}

/**
 * Check if workspace and jupyter server is initialized for the user.
 * If not, wait for initialization to be done and then proceed to pass
 * the request to jupyter server.
 */
function handleJupyterRequest(request: http.ServerRequest, response: http.ServerResponse): void {
  var userId = userManager.getUserId(request);

  if (jupyter.getPort(request) == 0) {
    // Jupyter server is not created yet. Creating it for user and call self again.
    // Another 'startForUser' may already be ongoing so this 'syncNow' will probably
    // be parked until the ongoing one is done.
    jupyter.startForUser(userId, function(e) {
      if (e) {
        response.statusCode = 500;
        response.end();
      }
      else {
        handleJupyterRequest(request, response);
      }
    });
    return;
  }
  jupyter.handleRequest(request, response);
}

/**
 * Handles all requests.
 * @param request the incoming HTTP request.
 * @param response the out-going HTTP response.
 * @path the parsed path in the request.
 */
function handleRequest(request: http.ServerRequest,
                       response: http.ServerResponse,
                       requestPath: string) {

  var userId = userManager.getUserId(request);
  if (loadedSettings === null) {
    loadedSettings = settings_.loadUserSettings(userId);
  }

  // If Jupyter is not initialized, do it as early as possible after authentication.
  startInitializationForUser(request);

  // Landing page redirects to /tree to be able to use the Jupyter file list as
  // the initial page.
  if (requestPath == '/') {
    userManager.maybeSetUserIdCookie(request, response);

    response.statusCode = 302;
    var redirectUrl : string;
    if (loadedSettings.startuppath) {
      let startuppath = loadedSettings.startuppath;

      // For backward compatibility with the old path format, prepend /tree prefix.
      // This code path should only be hit by the old Jupyter-based UI, which expects
      // a '/' prefix in the startup path, but we don't want to replicate it if it
      // is already saved in the user setting.
      if (startuppath.indexOf('/tree') !== 0) {
        startuppath = '/tree' + startuppath;
      }
      redirectUrl = startuppath;
    } else {
      redirectUrl = '/tree/datalab';
    }
    if (redirectUrl.indexOf(appSettings.datalabBasePath) != 0) {
      redirectUrl = path.join(appSettings.datalabBasePath, redirectUrl);
    }
    response.setHeader('Location', redirectUrl);
    response.end();
    return;
  }

  if (requestPath.indexOf('/_nocachecontent/') == 0) {
    if (process.env.KG_URL) {
      reverseProxy.handleRequest(request, response, null);
    }
    else {
      noCacheContent.handleRequest(requestPath, response);
    }
    return;
  }

  if (requestPath == '/api/creds' || requestPath == '/api/metadata') {
    metadataHandler(request, response);
    return;
  }

  if (requestPath.indexOf('/api/basepath') === 0) {
    response.statusCode = 200;
    response.end(appSettings.datalabBasePath);
    return;
  }
  
  if (requestPath.indexOf('/_appsettings') === 0) {
    settingHandler(request, response);
    return;
  }

  // Requests proxied to Jupyter
  if ((requestPath.indexOf('/api') == 0) ||
      (requestPath.indexOf('/tree') == 0) ||
      (requestPath.indexOf('/notebooks') == 0) ||
      (requestPath.indexOf('/nbconvert') == 0) ||
      (requestPath.indexOf('/nbextensions') == 0) ||
      (requestPath.indexOf('/files') == 0) ||
      (requestPath.indexOf('/edit') == 0) ||
      (requestPath.indexOf('/terminals') == 0) ||
      (requestPath.indexOf('/sessions') == 0)) {

    if (requestPath.indexOf('/api/contents') == 0) {
      const subPath = decodeURIComponent(requestPath.substr('/api/contents'.length));
      const filePath = path.join('/content', subPath);
      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
          loadedSettings.startuppath = subPath;
          settings_.updateUserSettingAsync(userId, 'startuppath', subPath);
        } else {
        }
      } catch (err) {
        logging.getLogger().error(err, 'Failed check for file "%s": %s', filePath, err.code);
      }
    }
    handleJupyterRequest(request, response);
    return;
  }

  // /_info displays information about the server for diagnostics.
  if (requestPath.indexOf('/_info') == 0) {
    infoHandler(request, response);
    return;
  }

  // /_restart forcibly ends this process.
  // TODO: This is oh so hacky. If this becomes interesting longer term, turn
  //       this into a real feature, that involves a confirmation prompt, as
  //       well validation to require a POST request.
  if (requestPath.indexOf('/_restart') == 0) {
    if ('POST' != request.method) {
      return;
    }
    setTimeout(function() { process.exit(0); }, 0);
    response.statusCode = 200;
    response.end();
    return;
  }

  if (requestPath.indexOf('/_stopvm') == 0) {
    stopVmHandler(request, response);
    return;
  }

  // /_usersettings updates a per-user setting.
  if (requestPath.indexOf('/_usersettings') == 0) {
    settingHandler(request, response);
    return;
  }

  // file search capability
  if (requestPath.indexOf('/_filesearch') === 0) {
    fileSearchHandler(request, response);
    return;
  }

  // idle timeout management
  if (requestPath.indexOf('/_timeout') === 0) {
    timeoutHandler(request, response);
    return;
  }

  // Not Found
  response.statusCode = 404;
  response.end();
}

/**
 * Returns true iff the supplied path should be handled by the static handler
 */
function isStaticResource(urlpath: string) {
  // /static and /custom paths for returning static content
  return urlpath.indexOf('/custom') == 0 ||
         urlpath.indexOf('/static') == 0 ||
         static_.isExperimentalResource(urlpath);
}

/**
 * Base logic for handling all requests sent to the proxy web server. Some
 * requests are handled within the server, while some are proxied to the
 * Jupyter notebook server.
 *
 * Error handling is left to the caller.
 *
 * @param request the incoming HTTP request.
 * @param response the out-going HTTP response.
 */
function uncheckedRequestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  var parsed_url = url.parse(request.url, true);
  var urlpath = parsed_url.pathname;

  logging.logRequest(request, response);

  var reverseProxyPort: string = reverseProxy.getRequestPort(request, urlpath);

  if (urlpath.indexOf('/signin') == 0 || urlpath.indexOf('/signout') == 0 ||
      urlpath.indexOf('/oauthcallback') == 0) {
    // Start or return from auth flow.
    auth.handleAuthFlow(request, response, parsed_url, appSettings);
  } else if (reverseProxyPort) {
    reverseProxy.handleRequest(request, response, reverseProxyPort);
  } else if (isStaticResource(urlpath)) {
    staticHandler(request, response);
  } else {
    handleRequest(request, response, urlpath);
  }
}

// The path that is used for the optional websocket proxy for HTTP requests.
const httpOverWebSocketPath: string = '/http_over_websocket';

function stopVmHandler(request: http.ServerRequest, response: http.ServerResponse) {
  if ('POST' != request.method) {
    return;
  }
  try {
    let vminfo = info.getVmInfo();
    childProcess.execSync(
      'gcloud compute instances stop ' + vminfo.vm_name +
         ' --project ' + vminfo.vm_project + ' --zone ' + vminfo.vm_zone,
      {env: process.env});
  } catch (err) {
    logging.getLogger().error(err, 'Failed to stop the VM. stderr: %s', err.stderr);
    return "unknown";
  }
}

function socketHandler(request: http.ServerRequest, socket: net.Socket, head: Buffer) {
  request.url = trimBasePath(request.url);
  // Avoid proxying websocket requests on this path, as it's handled locally rather than by Jupyter.
  if (request.url != httpOverWebSocketPath) {
    jupyter.handleSocket(request, socket, head);
  }
}

function trimBasePath(requestPath: string): string {
  let pathPrefix = appSettings.datalabBasePath;
  if (requestPath.indexOf(pathPrefix) == 0) {
    let newPath = "/" + requestPath.substring(pathPrefix.length);
    return newPath;
  } else {
    return requestPath;
  }
}

/**
 * Handles all requests sent to the proxy web server. Some requests are handled within
 * the server, while some are proxied to the Jupyter notebook server.
 * @param request the incoming HTTP request.
 * @param response the out-going HTTP response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse) {
  request.url = trimBasePath(request.url);
  idleTimeout.resetBasedOnPath(request.url);
  try {
    uncheckedRequestHandler(request, response);
  } catch (e) {
    logging.getLogger().error('Uncaught error handling a request to "%s": %s', request.url, e);
  }
}

/**
 * Runs the proxy web server.
 * @param settings the configuration settings to use.
 */
export function run(settings: common.AppSettings): void {
  appSettings = settings;
  metadata.init(settings);
  userManager.init(settings);
  jupyter.init(settings);
  auth.init(settings);
  noCacheContent.init(settings);
  reverseProxy.init(settings);
  sockets.init(settings);

  metadataHandler = metadata.createHandler(settings);
  healthHandler = health.createHandler(settings);
  infoHandler = info.createHandler(settings);
  settingHandler = settings_.createHandler();
  staticHandler = static_.createHandler(settings);
  fileSearchHandler = fileSearch.createHandler(appSettings);
  timeoutHandler = idleTimeout.createHandler();

  server = http.createServer(requestHandler);
  server.on('upgrade', socketHandler);

  if (settings.allowHttpOverWebsocket) {
    new wsHttpProxy.WsHttpProxy(server, httpOverWebSocketPath, settings.allowOriginOverrides);
  }

  logging.getLogger().info('Starting DataLab server at http://localhost:%d%s',
                           settings.serverPort,
                           settings.datalabBasePath);
  backupUtility.startBackup(settings);
  process.on('SIGINT', () => process.exit());

  idleTimeout.initAndStart();
  server.listen(settings.serverPort);
}

/**
 * Stops the server and associated Jupyter server.
 */
export function stop(): void {
  jupyter.close();
}
