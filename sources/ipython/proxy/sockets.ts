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
import util = require('util');
import WebSocket = require('ws');

interface Session {
  id: number;
  kernel: string;
  socket: SocketIO.Socket,
  webSockets: common.Map<WebSocket>;
  channels: string[];
}

interface SessionMessage {
  kernel: string;
}

interface DataMessage {
  channel: string;
  data: string;
}

var webSocketChannels = [ 'shell', 'iopub', 'stdin' ];

var appSettings: common.Settings;
var sessionCounter = 0;

/**
 * Creates a WebSocket instance to connect to the IPython server for the specified session's
 * kernel, and the specified IPython channel.
 */
function createWebSocket(session: Session, channel: string): WebSocket {
  var socketUrl = util.format('%s/api/kernels/%s/%s',
                              appSettings.ipythonSocketServer, session.kernel, channel);

  var ws = new WebSocket(socketUrl);
  ws.on('open', function() {
      // Stash the resulting WebSocket, now that it is in open state
      session.webSockets[channel] = ws;
      session.channels.push(channel);

      if (session.channels.length == webSocketChannels.length) {
        // If all of the channels are now open, send the client a notification.
        session.socket.emit('kernel', { kernel: session.kernel });
      }
    })
    .on('close', function() {
      // Remove the WebSocket from the session, once it is in closed state
      logging.getLogger().debug('WebSocket [%d-%s] closed', session.id, channel);
      delete session.webSockets[channel];
    })
    .on('message', function(data: any) {
      // Propagate messages arriving on the WebSocket to the client.
      logging.getLogger().debug('WebSocket [%d-%s] message\n%s', session.id, channel,
                                JSON.stringify(data));
      session.socket.emit('data', { channel: channel, data: data });
    });

  return ws;
}

/**
 * Closes all WebSocket instances associated with the session.
 */
function closeWebSockets(session: Session) {
  for (var n in session.webSockets) {
    session.webSockets[n].close();
  }
  session.webSockets = {};
  session.channels = [];
}

/**
 * Handles communication over the specified socket.
 */
function socketHandler(socket: SocketIO.Socket) {
  sessionCounter++;

  // Each socket is associated with a session that tracks the kernel id, and
  // associated WebSocket instances to the IPython server (one per channel).
  var session: Session = {
    id: sessionCounter,
    kernel: '',
    socket: socket,
    webSockets: {},
    channels: []
  };

  logging.getLogger().debug('Socket connected for session %d', session.id);

  socket.on('disconnect', function() {
    logging.getLogger().debug('Socket disconnected for session %d', session.id);

    // Handle client disconnects to close WebSockets, so as to free up resources
    closeWebSockets(session);
  });

  socket.on('start', function(message: SessionMessage) {
    // The client sends this message per channel within a session. However all initializtion of
    // underlying WebSockets is done on the first message. So ignore every subsequent message
    // for the same kernel.
    // The kernel will be different within the same session, when sockets are being re-opened
    // after the kernel restart (using a new kernel id).

    logging.getLogger().debug('Start in session %d with kernel %s', session.id, message.kernel);
    if (session.kernel == message.kernel) {
      logging.getLogger().debug('Session is already associated with same kernel');
      return;
    }

    // Close previous WebSockets for another kernel, in case this is a restart scenario, and
    // somehow a closekernel message wasn't sent.
    closeWebSockets(session);

    session.kernel = message.kernel;
    webSocketChannels.forEach(function(channel) {
      createWebSocket(session, channel);
    })
  });

  socket.on('stop', function(message: SessionMessage) {
    // The client sends this message once per channel within the session when channels are being
    // closed. All WebSockets are closed on the first message. So ignore every subsequent message
    // by blanking out the kernel associated with this session.

    logging.getLogger().debug('Stop in session %d with kernel %s', session.id, message.kernel);
    if (session.kernel != message.kernel) {
      logging.getLogger().debug('Session is no longer associated with same kernel');
      return;
    }

    closeWebSockets(session);
    session.kernel = '';
  });

  socket.on('senddata', function(message: DataMessage) {
    // The client sends this message per data message to a particular channel. Propagate the
    // message over to the WebSocket associated with the specified channel.

    logging.getLogger().debug('Send data in session %d on %s channel\n%s',
                              session.id, message.channel, message.data);
    var ws = session.webSockets[message.channel];
    if (ws) {
      ws.send(message.data, function(e) {
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
