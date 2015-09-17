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
/// <reference path="common.d.ts" />

import logging = require('./logging');

// TODO: this should be instanced classes where we can separate callback paths.
var allUserCallbacks: common.Map<common.Callback<number>[]> = {};

function getUserKey(userId: string, path: string): string {
  return path + ':' + userId;
}

/**
 * Register a callback and will be invoked when invokeAllCallbacks will be called. 
 * Returns whether this is a new request. If so, the caller should continue. 
 * Otherwise, caller should return since another same request is already ongoing.
 */
export function checkAndRegisterCallback(userId: string, path: string, 
                                         cb: common.Callback<number>): boolean {
  if (!cb) {
    return true;
  }
  var callbacks: common.Callback<number>[] = allUserCallbacks[getUserKey(userId, path)];
  if (!callbacks) {
    callbacks = new Array();
    allUserCallbacks[getUserKey(userId, path)] = callbacks;
  }
  callbacks.push(cb);
  return (callbacks.length == 1);
}

/**
 * All registered callback for the user and path will be invoked and cleaned up.
 */
export function invokeAllCallbacks(userId: string, path: string, err: Error, code: number) {
  var callbacks: common.Callback<number>[] = allUserCallbacks[getUserKey(userId, path)];
  if (!callbacks) {
    return;
  }
  for(var key in callbacks) {
    callbacks[key](err, code);
  }
  delete allUserCallbacks[getUserKey(userId, path)];
}
