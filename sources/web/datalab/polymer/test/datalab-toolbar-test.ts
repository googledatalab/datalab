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

/*
 * For all Polymer component testing, be sure to call Polymer's flush() after
 * any code that will cause shadow dom redistribution, such as observed array
 * mutation, wich is used by the dom-repeater in this case.
 */

describe('<table-preview>', () => {
  let testFixture: ToolbarElement;

  beforeEach(() => {
    GapiManager.listenForSignInChanges = () => Promise.resolve();
    ApiManager.getBasePath = () => {
      return Promise.resolve('testbase');
    };

    testFixture = fixture('toolbar-fixture');
  });

  it('opens and closes account menu', () => {
    testFixture.$.accountButton.click();
    assert(testFixture.$.accountDropdown.opened, 'account dropdown should open on click');

    // Click the account button again to make sure it also closes the dropdown.
    testFixture.$.accountButton.click();
    assert(!testFixture.$.accountDropdown.opened, 'account dropdown should close on click');
  });

  it('opens and closes info dialog', (done) => {
    let hasOpened = false;

    testFixture.$.infoDialog.addEventListener('iron-overlay-closed', () => {
      assert(hasOpened, 'dialog should have opened on first click');
      done();
    });

    testFixture.$.infoDialog.addEventListener('iron-overlay-opened', () => {
      hasOpened = true;
      testFixture.$.infoButton.click();
    });

    testFixture.$.infoButton.click();
  });

  it('opens and closes settings dialog', (done) => {
    let hasOpened = false;

    testFixture.$.settingsDialog.addEventListener('iron-overlay-closed', () => {
      assert(hasOpened, 'dialog should have opened on first click');
      done();
    });

    testFixture.$.settingsDialog.addEventListener('iron-overlay-opened', () => {
      hasOpened = true;
      testFixture.$.settingsButton.click();
    });

    testFixture.$.settingsButton.click();
  });
});
