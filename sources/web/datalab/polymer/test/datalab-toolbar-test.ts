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

  before(() => {
    SettingsManager.getAppSettingsAsync = () => {
      const mockSettings: common.AppSettings = {
        allowHttpOverWebsocket: true,
        allowOriginOverrides: [],
        configUrl: '',
        consoleLogLevel: 'verbose',
        consoleLogging: true,
        contentDir: '',
        datalabBasePath: '',
        datalabRoot: '',
        defaultFileManager: 'mock',
        docsGcsPath: '',
        enableAutoGCSBackups: true,
        enableFilesystemIndex: true,
        fakeMetadataAddress: {host: 'metadata.google.internal', port: 80},
        feedbackId: '',
        gatedFeatures: ['userSettings'],
        idleTimeoutInterval: '',
        idleTimeoutShutdownCommand: '',
        instanceId: '',
        jupyterArgs: [''],
        knownTutorialsUrl: '',
        logEndpoint: '',
        logFileCount: 0,
        logFilePath: '',
        logFilePeriod: '',
        metadataHost: '',
        nextJupyterPort: 0,
        numDailyBackups: 0,
        numHourlyBackups: 0,
        numWeeklyBackups: 0,
        oauth2ClientId: '',
        proxyWebSockets: '',
        release: '',
        serverPort: 0,
        socketioPort: 0,
        supportUserOverride: true,
        supportedFileBrowserSources: [''],
        useWorkspace: true,
        versionId: '',
      };
      return Promise.resolve(mockSettings);
    };
    SettingsManager.getUserSettingsAsync = () => {
      return Promise.resolve({
        idleTimeoutInterval: '',
        idleTimeoutShutdownCommand: '',
        startuppath: '',
        theme: '',
      });
    };
  });

  beforeEach((done) => {
    GapiManager.auth.listenForSignInChanges = () => Promise.resolve();
    ApiManager.getBasePath = () => {
      return Promise.resolve('testbase');
    };

    testFixture = fixture('toolbar-fixture');
    testFixture.ready().then(() => {
      Polymer.dom.flush();
      done();
    });
  });

  it('opens and closes account menu', () => {
    testFixture.$.accountButton.click();
    assert(testFixture.$.accountDropdown.opened, 'account dropdown should open on click');

    // Click the account button again to make sure it also closes the dropdown.
    testFixture.$.accountButton.click();
    assert(!testFixture.$.accountDropdown.opened, 'account dropdown should close on click');
  });

  it('opens and closes info dialog', () => {
    testFixture.$.infoButton.click();
    assert(testFixture.$.infoDialog.opened, 'info dropdown should open on click');

    // Click the close button and make sure it also closes the dialog.
    const closeButton = testFixture.$.infoDialog.querySelector('paper-button');
    closeButton.click();
    assert(!testFixture.$.infoDialog.opened,
        'info dialog should close on clicking close button');
  });

  it('opens and closes settings dialog', () => {
    testFixture.$.settingsButton.click();
    assert(testFixture.$.settingsDialog.opened, 'info dropdown should open on click');

    // Click the close button and make sure it also closes the dialog.
    const closeButton = testFixture.$.settingsDialog.querySelector('paper-button');
    closeButton.click();
    assert(!testFixture.$.settingsDialog.opened,
        'settings dialog should close on clicking close button');
  });
});
