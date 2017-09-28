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
import settings = require('./settings');
import url = require('url');
import userManager = require('./userManager');

const idleCheckIntervalSeconds = 10;    // Seconds to wait between idle checks
const idleTimeoutMinSeconds = 300;   // Don't allow setting a timeout less than 5 minutes

let idleTimeoutEnabled = true;  // Allow user to enable and disable the timeout
let idleTimeoutSeconds = 0;   // Shutdown after being idle this long; turned off if 0 or NaN
let lastReset: number;  // The epoch, in seconds, since the last timout reset
let shutdownCommand = '';

export function initAndStart() {
  let disableIdleTimeoutProcess = process.env.DATALAB_DISABLE_IDLE_TIMEOUT_PROCESS || 'false';
  if (disableIdleTimeoutProcess === 'false') {
    init();
    reset();
    startChecker();
  }
}

export function init() {
  const userSettings = settings.loadUserSettings(null);
  shutdownCommand = userSettings.idleTimeoutShutdownCommand;
  if (!shutdownCommand) {
    shutdownCommand = process.env.DATALAB_SHUTDOWN_COMMAND;
  }
  if (shutdownCommand) {
    let idleTimeoutStr = userSettings.idleTimeoutInterval;
    if (idleTimeoutStr === undefined) {
      logging.getLogger().debug('idleTimeoutStr from user settings is undefined');
    } else {
      logging.getLogger().debug('idleTimeoutStr from user settings: ' + idleTimeoutStr);
    }
    if (!idleTimeoutStr) {
      idleTimeoutStr = process.env.DATALAB_IDLE_TIMEOUT;
      if (idleTimeoutStr === undefined) {
        logging.getLogger().debug('idleTimeoutStr from env is undefined');
      } else {
        logging.getLogger().debug('idleTimeoutStr from env: ' + idleTimeoutStr);
      }
    }
    // For instances (actually, PDs) created before idle-timeout was implemented,
    // the user's settings file may not have a value for idleTimeoutInterval.
    // In this case, we set it to 0s to continue using the the no-idle-timeout
    // behavior that was in place when that PD was created.
    if (idleTimeoutStr === undefined) {
      idleTimeoutStr = '0s';
    }
    setIdleTimeoutInterval(idleTimeoutStr);
  } else {
    idleTimeoutSeconds = NaN;   // No shutdown command available
    logging.getLogger().info('No shutdown command, idle timeout is disabled');
  }
}

export function setIdleTimeoutInterval(idleTimeoutStr: string) {
  const { seconds, errorMessage } = parseAndValidateInterval(idleTimeoutStr);
  if (errorMessage) {
    logging.getLogger().error('For idleTimeoutInterval "' + idleTimeoutStr + '": ' + errorMessage);
    // Don't change idleTimeoutSeconds
  } else if (! (seconds > 0)) {
    logging.getLogger().info('No idle timeout value, idle timeout is disabled');
    idleTimeoutSeconds = 0;
  } else {
    logging.getLogger().info('Idle timeout set to ' + seconds + ' seconds');
    idleTimeoutSeconds = seconds;
  }
}

// Parses a string like '30s' or '1h 15m 5s' and returns {seconds, errorMessage}.
// If no input string, or unrecognized stuff, returns NaN.
export function parseAndValidateInterval(str: string) {
  if (typeof(str) === 'number') {
    return { seconds: <number>str, errorMessage: null };
  }
  if (!str) {
    return { seconds: NaN, errorMessage: 'No input value specified' };
  }
  let total = 0;
  const regAndMults = [
    [ /(\d+)\s*(seconds?|s)/, 1 ],
    [ /(\d+)\s*(minutes?|m)/, 60 ],
    [ /(\d+)\s*(hours?|h)/, 60 * 60 ],
    [ /(\d+)\s*(days?|d)/, 60 * 60 * 24 ],
    [ /(\d+)\s*$/, 1 ],
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
    return { seconds: NaN, errorMessage: 'Invalid format' };
  }
  if (total > 0 && total < idleTimeoutMinSeconds) {
    const message = total + ' is smaller than minimum of ' + idleTimeoutMinSeconds + ' seconds';
    return { seconds: total, errorMessage: message };
  };
  return { seconds: total, errorMessage: null };
}

export function resetBasedOnPath(path: string) {
  if (_shouldResetOnPath(path)) {
    reset();
  }
}

function _shouldResetOnPath(path: string) {
  if (path.indexOf('/_timeout')==0) {
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

// Returns true if the data is a heartbeat message.
// The right way to do this would be to decode the message, but I don't know how to do that.
function isHeartbeat(data: any) {
  return data.length == 6 && data[0] == 0x8a && data[1] == 0x80;
}

export function reset() {
  logging.getLogger().debug('reset idle timeout (' + idleTimeoutSeconds + 's)');
  lastReset = _nowSeconds();
}

function _nowSeconds() {
  return Date.now() / 1000;   // seconds since the epoch
}

function _hasTimedOut() {
  if (isTimeoutEnabled()) {
    const idleSeconds = _nowSeconds() - lastReset;
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
  const idleSeconds = _nowSeconds() - lastReset;
  const secondsRemaining = idleTimeoutSeconds - idleSeconds;
  if (secondsRemaining < 0) {
    return 0;
  } else {
    return Math.floor(secondsRemaining);
  }
}

function shutdownIfTimedOut() {
  if (_hasTimedOut()) {
    // TODO - check to see if the kernel is idle; if not, don't try to stop the VM
    try {
      logging.getLogger().warn('Idle timeout, shutting down with this command: ' + shutdownCommand);
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
