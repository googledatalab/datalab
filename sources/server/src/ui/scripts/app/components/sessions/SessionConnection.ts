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


/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <reference path="../../../../../../../../externs/ts/socket.io.d.ts" />
import socketio = require('socketio');
import constants = require('app/common/Constants');
import logging = require('app/common/Logging');
import _app = require('app/App');


var log = logging.getLogger(constants.scopes.sessionConnection);

/**
 * Creates a (singleton) socket.io connection to the server.
 *
 * TODO(bryantd): Add the ability to disassociate this connection from the session and have it
 * join a new session. For detecting, see the angular events: $locationChangeStart and
 * $routeChangeStart. Could be implemented by sending some sort of JoinSession message
 * without require the underlying web socket connection to be torn down and recreated.
 *
 * @param rootScope The Angular $rootScope.
 * @param location The Angular $location service.
 * @param route The Angular $route service.
 * @return A session connection instance that wraps a socket.io connection.
 */
function sessionConnectionFactory(
    rootScope: ng.IRootScopeService,
    location: ng.ILocationService,
    route: ng.route.IRouteService
    ): app.ISessionConnection {

  var socket: Socket = socketio(location.host(), {
    query: 'notebookPath=' + route.current.params.notebookPath
  });

  return {
    on: function(messageType: string, callback: app.SessionMessageHandler) {
      socket.on(messageType, function(message: any) {
        log.debug('socket.io on "' + messageType + '":', message);

        // Execute the given callback within a scope.$apply so that angular will
        // know about any variable updates (that it can then propagate).
        // TODO(bryantd): See if possible to do away with this forced digest cycle
        rootScope.$apply(function() {
          callback(message);
        });
      });
    },
    emit: function(messageType: string, message: any) {
      log.debug('socket.io emit "' + messageType + '":', message);
      socket.emit(messageType, message);
    }
  };
}
sessionConnectionFactory.$inject = ['$rootScope', '$location', '$route'];


_app.registrar.factory(constants.sessionConnection.name, sessionConnectionFactory);
log.debug('Registered socket connection factory');
