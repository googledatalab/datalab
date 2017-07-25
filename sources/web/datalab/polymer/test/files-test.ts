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

declare function assert(condition: boolean, message?: string): null;
declare function fixture(element: string): any;

/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />
/// <reference path="../node_modules/@types/sinon/index.d.ts" />
/// <reference path="../components/datalab-files/datalab-files.ts" />

describe('<datalab-files>', () => {
  let testFixture: FilesElement;

  before(() => {
    SettingsManager.getUserSettingsAsync = (forceRefresh: boolean) => {
      assert(forceRefresh === true, 'datalab-files should refresh settings on load');
      const mockSettings: common.UserSettings = {
        idleTimeoutInterval: '',
        idleTimeoutShutdownCommand: '',
        oauth2ClientId: '',
        startuppath: 'testpath',
        theme: 'light',
      };
      return Promise.resolve(mockSettings);
    };
  });

  beforeEach(() => {
    testFixture = fixture('files-fixture');
  });

  it('displays list of files correctly', () => {
    Polymer.dom.flush();
    debugger;
  });
});
