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


/**
 * Common utility functions.
 */

/**
 * Registers a single callback to process a specified event and issue async scope digest after.
 *
 * @param scope The scope on which to listen for events.
 * @param eventName The name of the event to listen for.
 * @param callback The callback to invoke with the event message whenever the event occurs.
 */
export function registerEventHandler(
    scope: ng.IScope,
    eventName: string,
    callback: app.Callback<any>) {

  scope.$on(eventName, (event: any, message: any) => {
    scope.$evalAsync(() => { callback(message) });
  });
}
