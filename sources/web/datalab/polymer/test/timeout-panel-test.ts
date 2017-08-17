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

/// <reference path="../components/timeout-panel/timeout-panel.ts" />

/*
 * For all Polymer component testing, be sure to call Polymer's flush() after
 * any code that will cause shadow dom redistribution.
 */

describe('<timeout-panel>', () => {
  let testFixture: TimeoutPanel;

  const mockDateNow = 1501799255586;
  const mockIdleTimeoutSeconds = 900; // 15 minutes
  const mockSecondsRemaining = 590;   // Just under ten minutes
  const mockTimeoutInfo: common.TimeoutInfo = {
    enabled: true,
    expirationTime: mockDateNow + mockSecondsRemaining * 1000,
    idleTimeoutSeconds: mockIdleTimeoutSeconds,
    secondsRemaining: mockSecondsRemaining,
  };
  const mockTimeoutDisabledInfo: common.TimeoutInfo = {
    enabled: false,
    expirationTime: mockDateNow + mockIdleTimeoutSeconds * 1000,
    idleTimeoutSeconds: mockIdleTimeoutSeconds,
    secondsRemaining: mockIdleTimeoutSeconds,
  };

  beforeEach(() => {
    testFixture = fixture('timeout-panel-fixture');
    Polymer.dom.flush();
  });

  it('starts with controls not displayed', () => {
    assert(testFixture.$.timeoutControls.hidden, 'timeoutControls should be hidden');
  });

  it('shows the enabled icon when opened', (done: () => void) => {
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

  it('shows the disabled icon after being disabled', (done: () => void) => {
    let timeoutEnabled = true;
    TimeoutManager.getTimeout = () => {
      const timeoutInfo = timeoutEnabled? mockTimeoutInfo : mockTimeoutDisabledInfo;
      return Promise.resolve(timeoutInfo);
    };
    TimeoutManager.setTimeoutEnabled = (enabled: boolean) => {
      timeoutEnabled = enabled;
      return Promise.resolve('OK');
    };
    testFixture.onOpenChange(true).then(() => {
      const enabledIcon = testFixture.$.timeoutControls.querySelector('#timeoutEnabledIcon') as HTMLElement;
      enabledIcon.click(); // disable the timer
    });
    // Clicking the button execute two sequential async calls. The following timeout
    // ensures that our mock executions complete before the rest of the code executes.
    window.setTimeout(() => {
      assert(testFixture.$.timeoutEnabledIcon.hidden, 'timeoutEnabledIcon should be hidden');
      assert(!testFixture.$.timeoutDisabledIcon.hidden, 'timeoutDisabledIcon should be showing');
      done();
    }, 1);
  });

  it('shows "disabled" text when disabled', (done: () => void) => {
    let timeoutEnabled = true;
    TimeoutManager.getTimeout = () => {
      const timeoutInfo = timeoutEnabled? mockTimeoutInfo : mockTimeoutDisabledInfo;
      return Promise.resolve(timeoutInfo);
    };
    TimeoutManager.setTimeoutEnabled = (enabled: boolean) => {
      timeoutEnabled = enabled;
      return Promise.resolve('OK');
    };
    Date.now = () => {
      return mockDateNow;
    }
    testFixture.onOpenChange(true).then(() => {
      const enabledIcon = testFixture.$.timeoutControls.querySelector('#timeoutEnabledIcon') as HTMLElement;
      enabledIcon.click(); // disable the timer
    });
    // Clicking the button execute two sequential async calls. The following timeout
    // ensures that our mock executions complete before the rest of the code executes.
    window.setTimeout(() => {
      assert(testFixture.$.timeoutText.innerHTML === 'Idle timeout is disabled', 'Timeout line should show disabled');
      done();
    });
  });

  it('shows time remaining text when enabled', (done: () => void) => {
    TimeoutManager.getTimeout = () => {
      return Promise.resolve(mockTimeoutInfo);
    };
    Date.now = () => {
      return mockDateNow;
    }
    testFixture.onOpenChange(true).then(() => {
      Polymer.dom.flush();
      assert(testFixture.$.timeoutText.innerHTML === 'Idle timeout in about 10m', 'Timeout line should show info');
      done();
    });
  });
});
