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

// sockets.js
// RequireJS plugin to create connected socket.io sockets.

require.config({
  paths: {
    socketio: '/socket.io/socket.io'
  },
  shim: {
    socketio: {
      exports: 'io'
    }
  }
});

define(['socketio'], function(socketio) {
  'use strict';

  function connectSocket(name, req, loadCallback, config) {
    if (config.isBuild) {
      loadCallback(null);
    }
    else {
      // Create a socket connection, that is forced to use long polling, i.e.
      // not use native WebSocket support (since that is being shimmed,
      // using this socket!).
      var socketUri = location.protocol + '//' + location.host + '/' + name;
      var socketOptions = {
        upgrade: false
      };

      var socket = socketio.connect(socketUri, socketOptions);
      socket.on('connect', function() {
        console.log(name + ' socket.io socket connected');
        loadCallback(socket);
      });
    }
  }

  return {
    load: connectSocket
  }
});
