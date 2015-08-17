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
/// <reference path="../../../externs/ts/node/socket.io.d.ts" />
/// <reference path="../../../externs/ts/node/node-ws.d.ts" />
/// <reference path="common.d.ts" />

import http = require('http');
import logging = require('./logging');
import socketio = require('socket.io');
import url = require('url');
import util = require('util');
import WebSocket = require('ws');

interface Session {
  id: number;
  url: string;
  socket: SocketIO.Socket;
  webSocket: WebSocket;
}

interface SessionMessage {
  url: string;
}

interface DataMessage {
  channel: string;
  data: string;
}

var webSocketChannels = [ 'shell', 'iopub', 'stdin' ];

var appSettings: common.Settings;
var sessionCounter = 0;

/**
 * Creates a WebSocket connected to the Jupyter server for the URL in the specified session.
 */
function createWebSocket(session: Session): WebSocket {
  var socketUrl = appSettings.jupyterSocketServer + url.parse(session.url).path;
  logging.getLogger().debug('Creating WebSocket to %s for session %d', socketUrl, session.id);

  var ws = new WebSocket(socketUrl);
  ws.on('open', function() {
      // Stash the resulting WebSocket, now that it is in open state
      session.webSocket = ws;
      session.socket.emit('open', { url: session.url });
    })
    .on('close', function() {
      // Remove the WebSocket from the session, once it is in closed state
      logging.getLogger().debug('WebSocket [%d] closed', session.id);
      session.webSocket = null;
      session.socket.emit('close', { url: session.url });
    })
    .on('message', function(data: any) {
      // Propagate messages arriving on the WebSocket to the client.
      logging.getLogger().debug('WebSocket [%d] message\n%s', session.id,
                                JSON.stringify(data));
      session.socket.emit('data', { data: data });
    })
    .on('error', function(e: any) {
      logging.getLogger().debug('WebSocket [%d] error\n%s', session.id,
                                JSON.stringify(e));
    });

  return ws;
}

/**
 * Closes all WebSocket instances associated with the session.
 */
function closeWebSocket(session: Session): void {
  if (session.webSocket) {
    session.webSocket.close();
  }
}

/**
 * Handles communication over the specified socket.
 */
function socketHandler(socket: SocketIO.Socket) {
  sessionCounter++;

  // Each socket is associated with a session that tracks the kernel id, and
  // associated WebSocket instance to the Jupyter server.
  var session: Session = {
    id: sessionCounter,
    url: '',
    socket: socket,
    webSocket: null
  };

  logging.getLogger().debug('Socket connected for session %d', session.id);

  socket.on('disconnect', function() {
    logging.getLogger().debug('Socket disconnected for session %d', session.id);

    // Handle client disconnects to close WebSockets, so as to free up resources
    closeWebSocket(session);
  });

  socket.on('start', function(message: SessionMessage) {
    logging.getLogger().debug('Start in session %d with url %s', session.id, message.url);

    session.url = message.url;
    session.webSocket = createWebSocket(session);
  });

  socket.on('stop', function(message: SessionMessage) {
    logging.getLogger().debug('Stop in session %d with url %s', session.id, message.url);

    closeWebSocket(session);
    session.webSocket = null;
  });

  socket.on('data', function(message: DataMessage) {
    // The client sends this message per data message to a particular channel. Propagate the
    // message over to the WebSocket associated with the specified channel.

    logging.getLogger().debug('Send data in session %d\n%s',
                              session.id, message.data);
    if (session.webSocket) {
      session.webSocket.send(message.data, function(e) {
        if (e) {
          logging.getLogger().error(e, 'Failed to send message to websocket');
        }
      });
    }
    else {
      logging.getLogger().error('Unable to send message; WebSocket is not open');
    }
  });
}

export function wrapServer(server: http.Server, settings: common.Settings): void {
  appSettings = settings;
  socketio.listen(server)
          .of('/session')
          .on('connection', socketHandler);
}
