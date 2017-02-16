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

declare module 'tcp-port-used' {

  class SimplePromise {
    then(resolved: () => void, rejected: (error: Error) => void): void;
  }

  class BooleanPromise {
    then(resolved: (b: boolean) => void, rejected: (error: Error) => void): void;
  }

  export function check(port: number, host: any): BooleanPromise;

  export function waitUntilUsed(port: number, retryMs: number, timeOutMs: number): SimplePromise;

  export function waitUntilUsedOnHost(port: number, host: string, retryTimeMs: number, timeOutMs: number): SimplePromise;
}
