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
/// <reference path="../../../externs/ts/node/node-ws.d.ts" />
/// <reference path="common.d.ts" />

import http = require('http');
import url = require('url');
import WebSocket = require('ws');

interface SocketEvent {
  type: string;
  msg?: string;
}

interface Session {
  socket: WebSocket;
  events: SocketEvent[];
  pendingResponse?: http.ServerResponse;
  pendingCookie?: any;
}

/**
 * The application settings instance.
 */
var appSettings: common.Settings;

/**
 * The set of active socket sessions being managed on the server. Each session represents
 * an instance of a WebSocket client.
 */
var socketSessions: common.Map<Session> = {};

/**
 * Creates a new socket session. This responds to the client with the id of the WebSocket
 * opened on behalf of the client, once that WebSocket has reached OPENED state.
 * @param sessionUrl the url the session being created sent by the client.
 * @param response the out-going response for the current HTTP request.
 */
function createSession(sessionUrl: string, response: http.ServerResponse): void {
  var parsedUrl = url.parse(sessionUrl);
  if ((parsedUrl.protocol == 'ws:') || (parsedUrl.protocol == 'wss:')) {
    // Build up the id of the socket to be the kernel id + socket name.
    var pathParts = parsedUrl.pathname.split('/');
    var id = pathParts.slice(-2).join('-');

    var socketUrl = appSettings.ipythonSocketServer + parsedUrl.path;
    var socket = new WebSocket(socketUrl);
    var session: Session = {
      socket: socket,
      events: <SocketEvent[]>[]
    };

    socket.id = id;
    socketSessions[socket.id] = session;

    socket.onopen = function(e) {
      successHandler(response, { id: socket.id });
    };
    socket.onclose = function(e) {
      session.socket = null;
      session.events.push({ type: 'close' });
    };
    socket.onmessage = function(e) {
      if (!session.socket) {
        // We're not tracking this socket anymore... so just go ahead and close it.
        e.target.close();
      }
      else {
        session.events.push({ type: 'message', msg: e.data });

        if (session.pendingResponse) {
          // If there is a pending response, complete it by sending the event that
          // was just bufffered. This ensures the client is notified as soon as possible.
          sendEvents(session);
        }
      }
    };
  }
  else {
    errorHandler(response, 400);
  }
}

/**
 * Closes an existing session.
 * @param id the id of the socket session to be closed.
 * @param response the out-going response for the current HTTP request.
 */
function closeSession(id: string, response: http.ServerResponse): void {
  var session = socketSessions[id];
  if (session && session.socket) {
    var socket = session.socket;

    session.socket = null;
    socket.close();

    delete socketSessions[id];
    successHandler(response);
  }
  else {
    errorHandler(response, 404);
  }
}

/**
 * Sends a message to the socket within an existing session.
 * @param id the id of the socket session containing the receipient socket.
 * @param message the message data to be sent.
 * @param response the out-going response for the current HTTP request.
 */
function sendMessage(id: string, message: string, response: http.ServerResponse): void {
  var session = socketSessions[id];
  if (session && session.socket) {
    session.socket.send(message);
    successHandler(response);
  }
  else {
    errorHandler(response, 404);
  }
}

/**
 * Handles poll requests for messages collected within a socket session.
 * @param id the id of the socket session whose messages are to be sent.
 * @param response the out-going response for the current HTTP request.
 */
function pollMessages(id: string, response: http.ServerResponse): void {
  var session = socketSessions[id];
  if (session && session.socket) {
    // Write out the response header early, even if the response won't be
    // immediately written out.
    response.writeHead(200, { 'Content-Type': 'application/json' });

    if (session.events.length) {
      // Complete the response immediately if there are accumulated events.
      sendEvents(session, response);
    }
    else {
      // If there aren't, hold on to the response for a short duration. If
      // events occur in the interim, they will complete the response (and
      // cancel this timeout), and if there aren't any, an empty resppnse
      // will be sent, once this timeout completes.
      session.pendingResponse = response;
      session.pendingCookie = setTimeout(function() {
        // Clear out the cookie, so it isn't attempted to be cleared again,
        // and then complete the response.
        session.pendingCookie = 0;
        sendEvents(session);
      }, appSettings.pollHangingInterval);
    }
  }
  else {
    errorHandler(response, 404);
  }
}

function sendEvents(session: Session, response?: http.ServerResponse): void {
  if (!response) {
    // This is the case when events are being sent if they arrived during
    // the hanging interval, or upon completion of that interval with no events
    // to send.
    response = session.pendingResponse;
    session.pendingResponse = null;
  }
  else {
    // This really shouldn't happen - a new poll request even though a pending
    // response is in place, since the client is supposed to wait. In case it
    // doesn't... kill off the old response first.
    if (session.pendingResponse) {
      session.pendingResponse.end();
      session.pendingResponse = null;
    }
  }

  // If the events are being sent in response to events that arrived in the
  // hanging interval interim, then clear out the cookie, so that the timeout
  // is canceled.
  if (session.pendingCookie) {
    clearTimeout(session.pendingCookie);
    session.pendingCookie = 0;
  }

  var events = session.events;
  session.events = <SocketEvent[]>[];

  response.write(JSON.stringify({ events: events }));
  response.end();
}

function requestHandler(request: http.ServerRequest, response: http.ServerResponse): void {
  console.log(request.url);

  if (request.method != 'POST') {
    errorHandler(response, 405);
    return;
  }

  // TODO: More error handling on the inputs...

  var requestUrl = url.parse(request.url, /* parseQueryString */ true);
  var path = requestUrl.pathname;

  if (path == '/socket/open') {
    var urlParameter: string = requestUrl.query.url;
    if (urlParameter) {
      createSession(urlParameter, response);
    }
    else {
      errorHandler(response, 400);
    }
  }
  else {
    var id: string = requestUrl.query.id;
    if (!id) {
      errorHandler(response, 400);
      return;
    }

    if (path == '/socket/close') {
      closeSession(id, response);
    }
    else if (path == '/socket/send') {
      var content = '';
      request.on('data', function(data: string) {
        content += data;
        if (content.length > appSettings.maxSocketMessageLength) {
          // If the request is too large, kill it.
          request.connection.destroy();
        }
      });
      request.on('end', function() {
        var data: common.Map<string> = JSON.parse(content);
        sendMessage(id, data['msg'], response);
      });
    }
    else if (path == '/socket/poll') {
      pollMessages(id, response);
    }
    else {
      errorHandler(response, 404);
    }
  }
}

function errorHandler(response: http.ServerResponse, statusCode: number): void {
  response.writeHead(statusCode);
  response.end();
}

function successHandler(response: http.ServerResponse, result?: any): void {
  result = result || {};

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.write(JSON.stringify(result));
  response.end();
}

export interface SocketRelay {
  (request: http.ServerRequest, response: http.ServerResponse): any;
}

/**
 * Creates the socket relay that will handle HTTP equivalents of socket functionality.
 * @param settings configuration settings for the application.
 * @returns the socket relay that can be used to handle socket requests.
 */
export function createSocketRelay(settings: common.Settings): SocketRelay {
  appSettings = settings;
  return requestHandler;
}
