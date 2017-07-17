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

    it('overrides default settings with user initial settings', function() {
      const dflt = '{"a": 123, "b": "xyz"}';
      const init = '{"b": "PQRS"}';
      const expected = '{"a":123,"b":"PQRS"}';
      expect(settings.mergeUserSettings(dflt, init)).toBe(expected);
    });
  });

});
});
