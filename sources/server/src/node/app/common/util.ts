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
 * Finds an open port available for binding.
 *
 * TODO(bryantd): this is a stop-gap implementation for port selection
 * Find a robust/reliable way of getting available ports to replace this.
 */
var portOffset = 0;
export function getAvailablePort (): number {
  return 45100 + portOffset++;
}

/**
 * Generic no-op function that takes a single arg
 */
export function noop (arg1: any): void {}
