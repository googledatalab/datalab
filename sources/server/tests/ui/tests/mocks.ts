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
 * Minimal route service mock for testing.
 *
 * Note: the double cast for the mock object here is significant.
 *
 * Without the double cast, there is a partial type mismatch because our mock only defines the
 * bits of the interface that we need for the test.
 *
 * The <any> cast performs "widening" on the type (applied first).
 * The <ng.route.IRouteService> cast "narrows" the type (applied second).
 */
export var routeService = <ng.route.IRouteService> <any> {
  current: {
    params: {
      notebookPath: 'fake-path.ipynb'
    }
  }
}
