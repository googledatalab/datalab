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

declare function assert(condition: boolean, message: string): null;
declare function fixture(element: string): any;

/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />
/// <reference path="../components/timeout-panel/timeout-panel.ts" />

/*
 * For all Polymer component testing, be sure to call Polymer's flush() after
 * any code that will cause shadow dom redistribution.
 */

describe('<timeout-panel>', () => {
  let testFixture: TimeoutPanel;

  const mockTimeoutInfo: common.TimeoutInfo = {
    enabled: true,
    expirationTime: Date.now() + 55 * 1000,
    idleTimeoutSeconds: 90,
    secondsRemaining: 55,
  };

  beforeEach(() => {
    testFixture = fixture('timeout-panel-fixture');
    Polymer.dom.flush();
  });

  it('starts with controls not displayed', () => {
    assert(testFixture.$.timeoutControls.hidden, 'timeoutControls should be hidden');
  });

  it('shows one icon when opened', (done: () => void) => {
    TimeoutManager.getTimeout = () => {
      return Promise.resolve(mockTimeoutInfo);
    };
    testFixture.onOpenChange(true).then(() => {
      Polymer.dom.flush();
      assert(!testFixture.$.timeoutEnabledIcon.hidden, 'timeoutEnabledIcon should be showing');
      assert(testFixture.$.timeoutDisabledIcon.hidden, 'timeoutDisabledIcon should be hidden');
      done();
    });
  });

});
