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


/// <reference path="../../../../../../externs/ts/socket.io.d.ts" />

/**
 * Minimal socket.io Socket stub for testing.
 */
var socket: Socket = {
  on: (event: string, callback: (data: any) => void ) => {},
  emit: (event: string, data: any) => {}
}

/**
 * Provides the minimal socket.io module interface.
 */
function socketioModule(path: string, options: any): Socket {
  return socket;
}

export = socketioModule;
