/*
 * Copyright 2017 Google Inc. All rights reserved.
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

/// <reference path="common.d.ts" />

import childProcess = require('child_process');
import http = require('http');
import logging = require('./logging');
import net = require('net');
import querystring = require('querystring');
import url = require('url');
import userManager = require('./userManager');

const idleCheckIntervalSeconds = 5;    // Seconds to wait between idle checks

let idleTimeoutEnabled = true;  // Allow for explicit disable without clearing other values
let idleTimeoutSeconds = 0;   // Shutdown after being idle this long; disabled if 0 or NaN
let lastUserActivity: number;  // The epoch, in seconds, of the last user activity
let shutdownCommand = '';

export function initAndStart(appSettings: common.Settings) {
  init(appSettings);
  reset();
  startChecker();
}

export function init(appSettings: common.Settings) {
  shutdownCommand = appSettings.idleTimeoutShutdownCommand;
  if (!shutdownCommand) {
    shutdownCommand = process.env.DATALAB_SHUTDOWN_COMMAND;
  }
  if (shutdownCommand) {
    idleTimeoutSeconds = appSettings.idleTimeoutSeconds;
    logging.getLogger().debug('idleTimeoutSeconds from settings: ' + idleTimeoutSeconds);
    if (!idleTimeoutSeconds) {
      idleTimeoutSeconds = parseInterval(process.env.DATALAB_IDLE_TIMEOUT);
    }
    logging.getLogger().debug('Idle timeout set to ' + idleTimeoutSeconds + ' seconds');
    if (! (idleTimeoutSeconds > 0)) {
      logging.getLogger().debug('No idle timeout value, idle timeout is disabled');
    }
  } else {
    idleTimeoutSeconds = NaN;   // No shutdown command available
    logging.getLogger().debug('No shutdown command, idle timeout is disabled');
  }
}

// Parse a string like '30s' or '1h 15m 5s' and return seconds.
// If no input string, or unrecognized stuff, returns NaN.
function parseInterval(str: string) {
  if (!str) {
    return NaN;
  }
  let total = 0;
  const regAndMults = [
    [ /(\d+)\s*(seconds?|s)/, 1 ],
    [ /(\d+)\s*(minutes?|m)/, 60 ],
    [ /(\d+)\s*(hours?|h)/, 60 * 60 ],
    [ /(\d+)\s*(days?|d)/, 60 * 60 * 24 ],
  ];
  regAndMults.forEach(rm => {
    const r : RegExp = rm[0] as RegExp;
    const m : number = rm[1] as number;
    const uStr = str.match(r);
    str = str.replace(r, '');
    if (uStr) { total += parseInt(uStr[1]) * m; }
  });
  str = str.replace(/\s*/, '');
  if (str) {
    logging.getLogger().debug('garbage left over in interval string: ' + str);
    return NaN;
  }
  return total;
}

export function resetBasedOnPath(path: string) {
  if (shouldResetOnPath(path)) {
    reset();
  }
}

function shouldResetOnPath(path: string) {
  logging.getLogger().debug('shouldReset sees path=' + path);
  if (path.indexOf('/_timeout')==0) {
    logging.getLogger().debug('path ' + path + ' should not reset idle timeout');
    return false;
  } else {
    return true;
  }
}

export function setupResetOnWebSocketRequests(socket : net.Socket) {
  socket.on('data', (data:any) => {
    // We get a data event when the client sends something to the jupyter server
    // via the websocket, for both execute-cell requests and for the heartbeat.
    logging.getLogger().debug('Got data event on socket, typeof(data)=' + typeof(data));
    logging.getLogger().debug(data);
    logging.getLogger().debug('length = ' + data.length);
    if (isHeartbeat(data)) {
      logging.getLogger().debug('Got a heartbeat, this does not reset the idle timer');
    } else {
      reset();
    }
  });
  // other messages on socket: end, message, finish, error
}

// Return true if the data is a heartbeat message.
// The right way to do this would be to decode the message, but I don't know how to do that.
function isHeartbeat(data: any) {
  return data.length == 6 && data[0] == 0x8a && data[1] == 0x80;
}

export function reset() {
  logging.getLogger().debug('reset idle timeout');
  lastUserActivity = nowSeconds();
}

function nowSeconds() {
  return Date.now() / 1000;   // seconds since the epoch
}

function hasTimedOut() {
  if (isTimeoutEnabled()) {
    const idleSeconds = nowSeconds() - lastUserActivity;
    logging.getLogger().debug('idleSeconds=' + Math.ceil(10*idleSeconds)/10 + ', idleTimeoutSeconds=' + idleTimeoutSeconds);
    return (idleSeconds > idleTimeoutSeconds);
  } else {
    return false;   // disabled
  }
}

function isTimeoutEnabled() {
  return idleTimeoutEnabled && (idleTimeoutSeconds > 0);  // disabled if 0 or NaN
}

// Returns the number of full seconds remaining until we time out, or 0 if timeout is not enabled.
// Note that 0 can mean either timeout is disabled, or we have timed out; call isTimeoutEnabled
// to see if timeout is disabled.
function timeoutSecondsRemaining() {
  const idleSeconds = nowSeconds() - lastUserActivity;
  const secondsRemaining = idleTimeoutSeconds - idleSeconds;
  if (secondsRemaining < 0) {
    return 0;
  } else {
    return Math.floor(secondsRemaining);
  }
}

function shutdownIfTimedOut() {
  if (hasTimedOut()) {
    // TODO - check to see if the kernel is idle; if not, don't try to stop the VM
    try {
      logging.getLogger().debug('Idle timeout, shutting down with this command: ' + shutdownCommand);
      childProcess.execSync(shutdownCommand, {env: process.env});
      logging.getLogger().debug('Shutdown command succeeded');
    } catch (err) {
      logging.getLogger().error(err, 'Shutdown failed. stderr: %s', err.stderr);
    }
  }
}

export function startChecker() {
  setInterval(shutdownIfTimedOut, idleCheckIntervalSeconds*1000);
}

/**
 * Implements timeout management request handling.
 * @param request the incoming http request.
 * @param response the outgoing http response.
 */
function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  const userId = userManager.getUserId(request);
  if ('POST' == request.method) {
    postTimeoutHandler(userId, request, response);
  } else {
    getTimeoutHandler(userId, request, response);
  }
}

/**
 * Handles 'GET' requests to the timeout management handler.
 * @param request the incoming http request.
 * @param response the outgoing http response.
 */
function getTimeoutHandler(userId: string, request: http.ServerRequest, response: http.ServerResponse): void {
  const timeoutInfo:any = {
    enabled: isTimeoutEnabled(),
    secondsRemaining: timeoutSecondsRemaining(),
    idleTimeoutSeconds: idleTimeoutSeconds
  };
  const parsedUrl = url.parse(request.url, true);
  if ('key' in parsedUrl.query) {
    const key = parsedUrl.query['key'];
    if (key in timeoutInfo) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(timeoutInfo[key]));
    } else {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end();
    }
  } else {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(timeoutInfo));
  }
}

/**
 * Handles 'POST' requests to the timeout management handler.
 * @param request the incoming http request.
 * @param response the outgoing http response.
 */
function postTimeoutHandler(userId: string, request: http.ServerRequest, response: http.ServerResponse): void {
  let formData : any;
  let body : string = "";
  request.on('data', function(chunk: string) { body += chunk; });
  request.on('end', function() {
    if (body) {
      formData = querystring.parse(body);
    } else {
      const parsedUrl = url.parse(request.url, true);
      formData = parsedUrl.query;
    }
    logging.getLogger().debug('got form data, type=' + typeof(formData));
    logging.getLogger().debug(formData);
    if (formData.enabled) {
      const newEnabled = formData.enabled == 'true' ? true : false;
      idleTimeoutEnabled = newEnabled;
      reset();  // Reset the timeout value when timeout is enabled or disabled
    }
    if (formData.reset) {
      reset();
    }
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('OK');
  });
}

/**
 * Creates the timeout management request handler.
 * @returns the request handler to handle timeout management requests.
 */
export function createHandler(): http.RequestHandler {
  return requestHandler;
}
