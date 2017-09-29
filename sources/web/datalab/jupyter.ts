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
/// <reference path="../../../third_party/externs/ts/node/tcp-port-used.d.ts" />
/// <reference path="common.d.ts" />

import auth = require('./auth')
import callbacks = require('./callbacks');
import childProcess = require('child_process');
import crypto = require('crypto');
import fs = require('fs');
import http = require('http');
import httpProxy = require('http-proxy');
import idleTimeout = require('./idleTimeout');
import logging = require('./logging');
import net = require('net');
import path = require('path');
import settings = require('./settings');
import tcp = require('tcp-port-used');
import url = require('url');
import userManager = require('./userManager');

interface JupyterServer {
  userId: string;
  port: number;
  notebooks: string;
  childProcess?: childProcess.ChildProcess;
  proxy?: httpProxy.ProxyServer;
}

/**
 * Jupyter servers key'd by user id (each server is associated with a single user)
 */
var jupyterServers: common.Map<JupyterServer> = {};
var nextJupyterPort = 9000;
var portRetryAttempts = 500;

/**
 * Get the next available port and pass it to the given `resolved` callback.
 */
function getNextJupyterPort(attempts: number, resolved: (port: number)=>void, failed: (error: Error)=>void) {
   if (attempts < 0) {
     var e = new Error('Failed to find a free port after ' + portRetryAttempts + ' attempts.');
     logging.getLogger().error(e, 'Failed to find a free port for the Jupyter server');
     failed(e);
     return;
   }

   if (nextJupyterPort > 65535) {
     // We've exhausted the entire port space. This is an extraordinary circumstance
     // so we log an error for it (but still continue).
     var e = new Error('Port range exhausted.');
     logging.getLogger().error(e, 'Exhausted the entire address space looking for free ports');
     nextJupyterPort = 9000;
   }

   var port = nextJupyterPort;
   nextJupyterPort++;

   tcp.check(port, "localhost").then(
     function(inUse: boolean) {
       if (inUse) {
         getNextJupyterPort(attempts - 1, resolved, failed);
       }
       else {
         logging.getLogger().info('Returning port %d', port);
         resolved(port);
       }
     },
     failed);
}

/**
 * Used to make sure no multiple initialization runs happen for the same user
 * at same time.
 */
var callbackManager: callbacks.CallbackManager = new callbacks.CallbackManager();

/**
 * Templates
 */
const templates: common.Map<string> = {
  // These cached templates can be overridden in sendTemplate
  'tree': fs.readFileSync(path.join(__dirname, 'templates', 'tree.html'), { encoding: 'utf8' }),
  'terminals': fs.readFileSync(path.join(__dirname, 'templates', 'terminals.html'), { encoding: 'utf8' }),
  'sessions': fs.readFileSync(path.join(__dirname, 'templates', 'sessions.html'), { encoding: 'utf8' }),
  'edit': fs.readFileSync(path.join(__dirname, 'templates', 'edit.html'), { encoding: 'utf8' }),
  'nb': fs.readFileSync(path.join(__dirname, 'templates', 'nb.html'), { encoding: 'utf8' })
};

/**
 * The application settings instance.
 */
var appSettings: common.AppSettings;

function pipeOutput(stream: NodeJS.ReadableStream, port: number, error: boolean) {
  stream.setEncoding('utf8');

  stream.on('data', (data: string) => {
    // Jupyter generates a polling kernel message once every 3 seconds
    // per kernel! This adds too much noise into the log, so avoid
    // logging it.

    if (data.indexOf('Polling kernel') < 0) {
      logging.logJupyterOutput('[' + port + ']: ' + data, error);
    }
  })
}

function createJupyterServerAtPort(port: number, userId: string, userDir: string) {
  var server: JupyterServer = {
    userId: userId,
    port: port,
    notebooks: userDir,
  };

  function exitHandler(code: number, signal: string): void {
    logging.getLogger().error('Jupyter process %d for user %s exited due to signal: %s',
                              server.childProcess.pid, userId, signal);
    delete jupyterServers[server.userId];
  }

  var secretPath = path.join(appSettings.datalabRoot, '/content/datalab/.config/notary_secret');
  var processArgs = appSettings.jupyterArgs.slice().concat([
    '--port=' + server.port,
    '--port-retries=0',
    '--notebook-dir="' + server.notebooks + '"',
    '--NotebookNotary.algorithm=sha256',
    '--NotebookNotary.secret_file=' + secretPath,
    '--NotebookApp.base_url=' + appSettings.datalabBasePath,
  ]);

  var notebookEnv: any = process.env;
  var processOptions = {
    detached: false,
    env: notebookEnv
  };

  server.childProcess = childProcess.spawn('jupyter', processArgs, processOptions);
  server.childProcess.on('exit', exitHandler);
  logging.getLogger().info('Jupyter process for user %s started with pid %d and args %j',
                           userId, server.childProcess.pid, processArgs);

  // Capture the output, so it can be piped for logging.
  pipeOutput(server.childProcess.stdout, server.port, /* error */ false);
  pipeOutput(server.childProcess.stderr, server.port, /* error */ true);

  // Create the proxy.
  var proxyOptions: httpProxy.ProxyServerOptions = {
    target: 'http://localhost:' + port + appSettings.datalabBasePath
  };

  server.proxy = httpProxy.createProxyServer(proxyOptions);
  server.proxy.on('proxyRes', responseHandler);
  server.proxy.on('error', errorHandler);

  tcp.waitUntilUsedOnHost(server.port, "localhost", 100, 15000).then(
    function() {
      jupyterServers[userId] = server;
      logging.getLogger().info('Jupyter server started for %s.', userId);
      callbackManager.invokeAllCallbacks(userId, null);
    },
    function(e) {
      logging.getLogger().error(e, 'Failed to start Jupyter server for user %s.', userId);
      callbackManager.invokeAllCallbacks(userId, e);
    });
}

/**
 * Starts the Jupyter server, and then creates a proxy object enabling
 * routing HTTP and WebSocket requests to Jupyter.
 */
function createJupyterServer(userId: string, remainingAttempts: number) {
  logging.getLogger().info('Checking user dir for %s exists', userId);
  var userDir = userManager.getUserDir(userId);
  logging.getLogger().info('Checking dir %s exists', userDir);
  if (!fs.existsSync(userDir)) {
    logging.getLogger().info('Creating user dir %s', userDir);
    try {
      fs.mkdirSync(userDir, parseInt('0755', 8));
    } catch (e) {
      // This likely means the disk is not yet ready.
      // We'll fall back to /content for now.
      logging.getLogger().info('User dir %s does not exist', userDir);
      userDir = '/content'
    }
  }

  nextJupyterPort = appSettings.nextJupyterPort;
  logging.getLogger().info('Looking for a free port on which to start Jupyter for %s', userId);
  getNextJupyterPort(
    portRetryAttempts,
    function(port: number) {
      logging.getLogger().info('Launching Jupyter server for %s at %d', userId, port);
      try {
        createJupyterServerAtPort(port, userId, userDir);
      } catch (e) {
        logging.getLogger().error(e, 'Error creating the Jupyter process for user %s', userId);
        callbackManager.invokeAllCallbacks(userId, e);
      }
    },
    function(e) {
      logging.getLogger().error(e, 'Failed to find a free port');
      if (remainingAttempts > 0) {
        attemptStartForUser(userId, remainingAttempts - 1);
      }
      else {
        logging.getLogger().error('Failed to start Jupyter server for user %s.', userId);
        callbackManager.invokeAllCallbacks(userId, new Error('failed to start jupyter server.'));
      }
    });
}

function listJupyterServers(): number[] {
  var psStdout = '';
  try {
    psStdout = childProcess.execSync('ps -C jupyter-notebook -o pid=', {}).toString();
  } catch (err) {
    // In the default case, where there are no jupyter-notebook processes running,
    // the 'ps' call will throw an error. We distinguish that case by ignoring
    // the error unless the stdout or stderr values are non-empty.
    if (err['stdout'] != '' || err['stderr'] != '') {
      throw err;
    }
  }

  var jupyterProcesses: number[] = [];
  var jupyterProcessIdStrings = psStdout.split('\n');
  for (var i in jupyterProcessIdStrings) {
    if (jupyterProcessIdStrings[i]) {
      var processId = parseInt(jupyterProcessIdStrings[i]);
      if (processId != NaN) {
        jupyterProcesses.push(processId);
      }
    }
  }
  return jupyterProcesses;
}

function killAllJupyterServers() {
  var jupyterProcesses = listJupyterServers();
  for (var i in jupyterProcesses) {
    var processId = jupyterProcesses[i];
    logging.getLogger().info('Killing abandoned Jupyter notebook process: %d', processId);
    process.kill(processId);
  }
}

export function getPort(request: http.ServerRequest): number {
  var userId = userManager.getUserId(request);
  var server = jupyterServers[userId];

  return server ? server.port : 0;
}

export function getInfo(): Array<common.Map<any>> {
  var info: Array<common.Map<any>> = [];
  for (var n in jupyterServers) {
    var jupyterServer = jupyterServers[n];

    var serverInfo: common.Map<any> = {
      userId: jupyterServer.userId,
      port: jupyterServer.port,
      notebooks: jupyterServer.notebooks,
      pid: jupyterServer.childProcess.pid
    };
    info.push(serverInfo);
  }

  return info;
}

function attemptStartForUser(userId: string, remainingAttempts: number) {
  try {
    createJupyterServer(userId, remainingAttempts);
  }
  catch (e) {
    logging.getLogger().error(e, 'Failed to start Jupyter server for user %s.', userId);
    callbackManager.invokeAllCallbacks(userId, e);
  }
}

/**
 * Starts a jupyter server instance for given user.
 */
export function startForUser(userId: string, cb: common.Callback0) {
  var server = jupyterServers[userId];
  if (server) {
    process.nextTick(function() { cb(null); });
    return;
  }

  if (!callbackManager.checkOngoingAndRegisterCallback(userId, cb)) {
    // There is already a start request ongoing. Return now to avoid multiple Jupyter
    // processes for the same user.
    return;
  }

  logging.getLogger().info('Starting jupyter server for %s.', userId);
  attemptStartForUser(userId, 10);
}

/**
 * Initializes the Jupyter server manager.
 */
export function init(settings: common.AppSettings): void {
  appSettings = settings;

  killAllJupyterServers();
}

/**
 * Closes the Jupyter server manager.
 */
export function close(): void {
  for (var n in jupyterServers) {
    var jupyterServer = jupyterServers[n];
    var jupyterProcess = jupyterServer.childProcess;

    try {
      jupyterProcess.kill('SIGHUP');
    }
    catch (e) {
    }
  }

  jupyterServers = {};
}


export function handleSocket(request: http.ServerRequest, socket: net.Socket, head: Buffer) {
  var userId = userManager.getUserId(request);
  var server = jupyterServers[userId];
  if (!server) {
    // should never be here.
    logging.getLogger().error('Jupyter server was not created yet for user %s.', userId);
    return;
  }
  server.proxy.ws(request, socket, head);
  idleTimeout.setupResetOnWebSocketRequests(socket);
}

export function handleRequest(request: http.ServerRequest, response: http.ServerResponse) {
  var userId = userManager.getUserId(request);
  var server = jupyterServers[userId];
  if (!server) {
    // should never be here.
    logging.getLogger().error('Jupyter server was not created yet for user %s.', userId);
    response.statusCode = 500;
    response.end();
    return;
  }

  var path = url.parse(request.url).pathname;
  if (path.indexOf('/sessions') == 0) {
    var templateData: common.Map<string> = getBaseTemplateData(request);
    sendTemplate('sessions', templateData, response);
    return;
  }
  server.proxy.web(request, response, null);
}

function getBaseTemplateData(request: http.ServerRequest): common.Map<string> {
  const userId: string = userManager.getUserId(request);
  const reportingEnabled: string = process.env.ENABLE_USAGE_REPORTING;
  // TODO: Cache the gcloudAccount value so that we are not
  // calling `gcloud` on every page load.
  const gcloudAccount : string = auth.getGcloudAccount();
  const signedIn = auth.isSignedIn(gcloudAccount);
  let templateData: common.Map<string> = {
    feedbackId: appSettings.feedbackId,
    versionId: appSettings.versionId,
    userId: userId,
    configUrl: appSettings.configUrl,
    knownTutorialsUrl: appSettings.knownTutorialsUrl,
    baseUrl: appSettings.datalabBasePath,
    reportingEnabled: reportingEnabled,
    proxyWebSockets: appSettings.proxyWebSockets,
    isSignedIn:  signedIn.toString(),
  };
  if (signedIn) {
    templateData['account'] = gcloudAccount;
    if (process.env.PROJECT_NUMBER) {
      var hash = crypto.createHash('sha256');
      hash.update(process.env.PROJECT_NUMBER);
      templateData['projectHash'] = hash.digest('hex');
    }
  }
  return templateData;
}

function sendTemplate(key: string, data: common.Map<string>, response: http.ServerResponse) {
  let template = templates[key];

  // Set this env var to point to source directory for live updates without restart.
  const liveTemplatesDir = process.env.DATALAB_LIVE_TEMPLATES_DIR
  if (liveTemplatesDir) {
    template = fs.readFileSync(path.join(liveTemplatesDir, key + '.html'), { encoding: 'utf8' });
  }

  // Replace <%name%> placeholders with actual values.
  // TODO: Error handling if template placeholders are out-of-sync with
  //       keys in passed in data object.
  const htmlContent = template.replace(/\<\%(\w+)\%\>/g, function(match, name) {
    return data[name];
  });

  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end(htmlContent);
}

function responseHandler(proxyResponse: http.ClientResponse,
                         request: http.ServerRequest, response: http.ServerResponse) {
  if (appSettings.allowOriginOverrides.length &&
      appSettings.allowOriginOverrides.indexOf(request.headers['origin']) != -1) {
    proxyResponse.headers['access-control-allow-origin'] = request.headers['origin'];
    proxyResponse.headers['access-control-allow-credentials'] = 'true';
  } else if (proxyResponse.headers['access-control-allow-origin'] !== undefined) {
    // Delete the allow-origin = * header that is sent (likely as a result of a workaround
    // notebook configuration to allow server-side websocket connections that are
    // interpreted by Jupyter as cross-domain).
    delete proxyResponse.headers['access-control-allow-origin'];
  }

  if (proxyResponse.statusCode != 200) {
    return;
  }

  // Set a cookie to provide information about the project and authenticated user to the client.
  // Ensure this happens only for page requests, rather than for API requests.
  var path = url.parse(request.url).pathname;
  if ((path.indexOf('/tree') == 0) || (path.indexOf('/notebooks') == 0) ||
      (path.indexOf('/edit') == 0) || (path.indexOf('/terminals') == 0)) {
    var templateData: common.Map<string> = getBaseTemplateData(request);
    var page: string = null;
    if (path.indexOf('/tree') == 0) {
      // stripping off the /tree/ from the path
      templateData['notebookPath'] = path.substr(6);

      page = 'tree';
    } else if (path.indexOf('/edit') == 0) {
      // stripping off the /edit/ from the path
      templateData['filePath'] = path.substr(6);
      templateData['fileName'] = path.substr(path.lastIndexOf('/') + 1);

      page = 'edit';
    } else if (path.indexOf('/terminals') == 0) {
      templateData['terminalId'] = 'terminals/websocket/' + path.substr(path.lastIndexOf('/') + 1);
      page = 'terminals';
    } else {
      // stripping off the /notebooks/ from the path
      templateData['notebookPath'] = path.substr(11);
      templateData['notebookName'] = path.substr(path.lastIndexOf('/') + 1);

      page = 'nb';
    }
    sendTemplate(page, templateData, response);

    // Suppress further writing to the response to prevent sending response
    // from the notebook server. There is no way to communicate that, so hack around the
    // limitation, by stubbing out all the relevant methods on the response with
    // no-op methods.
    response.setHeader = placeHolder;
    response.writeHead = placeHolder;
    response.write = placeHolder;
    response.end = placeHolder;
  }
}

function errorHandler(error: Error, request: http.ServerRequest, response: http.ServerResponse) {
  logging.getLogger().error(error, 'Jupyter server returned error.')

  response.writeHead(500, 'Internal Server Error');
  response.end();
}

function placeHolder(): boolean { return false; }
