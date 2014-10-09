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


/**
 * Type definitions for zmq node module v 2.8.0
 */
/// <reference path="node.d.ts" />


declare module 'zmq' {

  import events = require('events');

  export interface Socket extends events.EventEmitter {
    identity?: string;
    connect (address: string): void;
    bind (address: string, callback: Function): void;
    subscribe (topic: string): void;
    send (data: any): void;
    close (): Socket;
  }

  export function socket(type: string): Socket;

}
