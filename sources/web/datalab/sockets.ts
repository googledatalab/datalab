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
/// <reference path="../../../third_party/externs/ts/node/socket.io.d.ts" />
/// <reference path="../../../third_party/externs/ts/node/node-ws.d.ts" />
/// <reference path="common.d.ts" />

import http = require('http');
import jupyter = require('./jupyter');
import logging = require('./logging');
import path_ = require('path');
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

var sessionCounter = 0;

/**
 * Creates a WebSocket connected to the Jupyter server for the URL in the specified session.
 */
function createWebSocket(port: number, session: Session): WebSocket {
  var socketUrl = 'ws://localhost:' + port + url.parse(session.url).path;
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
      logging.getLogger().debug('WebSocket [%d] message\n%j', session.id, data);
      session.socket.emit('data', { data: data });
    })
    .on('error', function(e: any) {
      logging.getLogger().error('WebSocket [%d] error\n%j', session.id, e);
      if (e.code == 'ECONNREFUSED') {
        // This happens in the following situation -- old kernel that has gone away
        // likely due to a restart/shutdown... and an old notebook client attempts to
        // reconnect to the old kernel. That connection will be refused.
        // In this case, there is no point in keeping this socket.io connection open.
        session.socket.disconnect(/* close */ true);
      }
    });

  return ws;
}

/**
 * Closes the WebSocket instance associated with the session.
 */
function closeWebSocket(session: Session): void {
  if (session.webSocket) {
    session.webSocket.close();
    session.webSocket = null;
  }
}

/**
 * Handles communication over the specified socket.
 */
function socketHandler(socket: SocketIO.Socket) {
  sessionCounter++;

  // Each socket is associated with a session that tracks the following:
  // - id: a counter for use in log output
  // - url: the url used to connect to the Jupyter server
  // - socket: the socket.io socket reference, which generates message
  //           events for anything sent by the browser client, and allows
  //           emitting messages to send to the browser
  // - webSocket: the corresponding WebSocket connection to the Jupyter
  //              server.
  // Within a session, messages recieved over the socket.io socket (from the browser)
  // are relayed to the WebSocket, and messages recieved over the WebSocket socket are
  // relayed back to the socket.io socket (to the browser).
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

    try {
      var port = jupyter.getPort(socket.request)
      session.url = message.url;
      session.webSocket = createWebSocket(port, session);
    }
    catch (e) {
      logging.getLogger().error(e, 'Unable to create WebSocket connection to %s', message.url);
      session.socket.disconnect(/* close */ true);
    }
  });

  socket.on('stop', function(message: SessionMessage) {
    logging.getLogger().debug('Stop in session %d with url %s', session.id, message.url);

    closeWebSocket(session);
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

export function init(settings: common.AppSettings): void {
  var io = socketio(String(settings.socketioPort), {
    path: path_.join(settings.datalabBasePath, 'socket.io'),
    transports: [ 'polling' ],
    allowUpgrades: false
  });

  io.of('/session')
    .on('connection', socketHandler);
}
