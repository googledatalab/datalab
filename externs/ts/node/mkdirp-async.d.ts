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
 * Type definitions for mkdirp node module v 0.5.0
 *
 */

declare module 'mkdirp' {
  /**
   * Note: this module typedef provides the async interface alone because TypeScript currently
   * lacks support for declaring callable objects.
   *
   * See: https://github.com/Microsoft/TypeScript/issues/183
   */

  function moduleFunc(path: string, cb: Function): void;
  export = moduleFunc;
}
