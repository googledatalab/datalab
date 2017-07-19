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

const fs = require('fs');

const BASE = '../../build/web/nb/';
const settings = require(BASE + 'settings');

describe('Unit tests', function() {
describe('settings', function() {

  describe('mergeUserSettings', function() {
    it('merges empty strings to empty object', function() {
      const dflt = '';
      const init = '';
      const expected = '{}';
      expect(settings.mergeUserSettings(dflt, init)).toBe(expected);
    });

    it('merges empty initial settings to unchanged default settings', function() {
      const dflt = '{"a": 123, "b": "xyz"}';
      const init = '';
      const expected = '{"a":123,"b":"xyz"}';
      expect(settings.mergeUserSettings(dflt, init)).toBe(expected);
    });

    it('merges empty default settings to unchanged initial settings', function() {
      const dflt = '';
      const init = '{"a": 123, "b": "xyz"}';
      const expected = '{"a":123,"b":"xyz"}';
      expect(settings.mergeUserSettings(dflt, init)).toBe(expected);
    });

    it('overrides default settings with user initial settings', function() {
      const dflt = '{"a": 123, "b": "xyz"}';
      const init = '{"b": "PQRS"}';
      const expected = '{"a":123,"b":"PQRS"}';
      expect(settings.mergeUserSettings(dflt, init)).toBe(expected);
    });
  });

  describe('updateUserSettingAsync', function() {
    it('does not write the file if the value is not changed', function(done) {
      spyOn(settings, 'getUserConfigDir').and.returnValue('/fake/path');
      spyOn(fs, 'existsSync').and.returnValue(true);
      spyOn(fs, 'readFileSync').and.returnValue('{"aKey": "aValue"}');
      const userId = 'fake';
      const key = 'aKey';
      const value = 'aValue';
      settings.updateUserSettingAsync(userId, key, value).then((status) => {
        expect(status).toBe(false);
        done();
      });
    });

    it('writes the file if the value is changed', function(done) {
      spyOn(settings, 'getUserConfigDir').and.returnValue('/fake/path');
      spyOn(settings, 'ensureDirExists').and.returnValue(true);
      spyOn(fs, 'existsSync').and.returnValue(true);
      spyOn(fs, 'readFileSync').and.returnValue('{"aKey": "aValue", "bKey": "bValue"}');
      spyOn(fs, 'writeFileSync');
      const expectedUpdatedSettings = '{"aKey":"aValue2","bKey":"bValue"}';
      const userId = 'fake';
      const key = 'aKey';
      const value = 'aValue2';
      settings.updateUserSettingAsync(userId, key, value).then((status) => {
        expect(status).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalledWith('/fake/path/settings.json', expectedUpdatedSettings);
        done();
      });
    });

    it('queues up multiple calls and executes them in order', function(done) {
      spyOn(settings, 'getUserConfigDir').and.returnValue('/fake/path');
      spyOn(settings, 'ensureDirExists').and.returnValue(true);
      spyOn(fs, 'existsSync').and.returnValue(true);
      spyOn(fs, 'readFileSync').and.callFake((path) => settingsContents);
      spyOn(fs, 'writeFileSync').and.callFake((path, contents) => settingsContents = contents);
      let settingsContents = '{"aKey": "aValue", "bKey": "bValue"}';
      const userId = 'fake';
      const key = 'aKey';
      const value = 'aValue2';
      let count = 0;
      settings.updateUserSettingAsync(userId, key, 'v1').then((status) => {
        expect(status).toBe(true);
        expect(count).toEqual(0);
        count = count + 1;
      });
      settings.updateUserSettingAsync(userId, key, 'v1').then((status) => {
        expect(status).toBe(false);
        expect(count).toEqual(1);
        count = count + 1;
      });
      settings.updateUserSettingAsync(userId, key, 'v2').then((status) => {
        expect(status).toBe(true);
        expect(count).toEqual(2);
        count = count + 1;
      });
      settings.updateUserSettingAsync(userId, key, 'v2').then((status) => {
        expect(status).toBe(false);
        expect(count).toEqual(3);
        count = count + 1;
        done();
      });
    });
  });
});
});
