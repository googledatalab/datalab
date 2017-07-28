/*
 * Copyright 2017 Google Inc. All rights reserved.
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
 * Extended version of a Polymer element that has an async ready() method that
 * can be used in a promise chain. It can also be called multiple times, to
 * support unit tests waiting on an element to finish initializing.
 * Elements that inherit this class should use the _init method to load do any
 * async operations in the initialization, instead of doing it in ready().
 */
class BaseElement extends Polymer.Element {

  public loadPromise: Promise<any>;

  ready() {
    super.ready();

    if (!this.loadPromise) {
      this.loadPromise = this._init();
    }
    return this.loadPromise;
  }

  _init(): Promise<any> {
    return Promise.resolve(null);
  }
}
