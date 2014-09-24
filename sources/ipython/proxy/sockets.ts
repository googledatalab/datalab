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

import common = require('./common');
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

var socketServer: string;
var socketSessions: common.Map<Session> = {};

function createSession(sessionUrl: string, response: http.ServerResponse): void {
  var parsedUrl = url.parse(sessionUrl);
  if ((parsedUrl.protocol == 'ws:') || (parsedUrl.protocol == 'wss:')) {
    // Build up the id of the socket to be the kernel id + socket name.
    var pathParts = parsedUrl.pathname.split('/');
    var id = pathParts.slice(-2).join('-');

    var socketUrl = socketServer + parsedUrl.path;
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
        e.target.close();
      }
      else {
        session.events.push({ type: 'message', msg: e.data });
        if (session.pendingResponse) {
          sendEvents(session);
        }
      }
    };
  }
  else {
    errorHandler(response, 400);
  }
}

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

function pollMessages(id: string, response: http.ServerResponse): void {
  var session = socketSessions[id];
  if (session && session.socket) {
    response.writeHead(200, { 'Content-Type': 'application/json' });

    if (session.events.length) {
      sendEvents(session, response);
    }
    else {
      session.pendingResponse = response;
      session.pendingCookie = setTimeout(function() {
        session.pendingCookie = 0;
        sendEvents(session);
      }, 60 * 1000);
    }
  }
  else {
    errorHandler(response, 404);
  }
}

function sendEvents(session: Session, response?: http.ServerResponse): void {
  if (!response) {
    response = session.pendingResponse;
    session.pendingResponse = null;
  }
  else {
    if (session.pendingResponse) {
      session.pendingResponse.end();
      session.pendingResponse = null;
    }
  }

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
        if (content.length > 1e6) {
          // If the request is over 1MB, kill it.
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

export function createSocketRelay(settings: common.Settings): SocketRelay {
  socketServer = 'ws://localhost:' + settings.ipythonPort;
  return requestHandler;
}
