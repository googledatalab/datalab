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
 * Unit tests for the idle-timeout functionality.
 */

const requirejs = require("requirejs");

// module mocks use relative path to the baseUrl
const hereMocks = '../../../../test/client-unit/';

requirejs.config({
  baseUrl: '../sources/web/datalab/static/',
  nodeRequire: require,
  map: {
    '*': {
      'base/js/dialog': hereMocks + 'dialog-mock',
      'base/js/events': hereMocks + 'events-mock',
    },
  },
});

const idleTimeout = requirejs('idle-timeout');

describe('Unit tests', function() {
describe('Idle-timeout', function() {

  describe('secondsToString', function() {
    it('converts zero and negative to empy string', function() {
      expect(idleTimeout._secondsToString(0)).toEqual('');
      expect(idleTimeout._secondsToString(-1)).toEqual('');
    });
    it('converts single-unit strings correctly', function() {
      expect(idleTimeout._secondsToString(1)).toEqual('1s');
      expect(idleTimeout._secondsToString(15)).toEqual('15s');
      expect(idleTimeout._secondsToString(2*60)).toEqual('2m');
      expect(idleTimeout._secondsToString(4*60*60)).toEqual('4h');
      expect(idleTimeout._secondsToString(3*24*60*60)).toEqual('3d');
    });
    it('converts multi-unit strings correctly', function() {
      expect(idleTimeout._secondsToString(60 + 5)).toEqual('1m 5s');
      expect(idleTimeout._secondsToString(1*60*60 + 30)).toEqual('1h 30s');
      expect(idleTimeout._secondsToString(3*60*60 + 10*60 + 25)).toEqual('3h 10m 25s');
      expect(idleTimeout._secondsToString(5*24*60*60 + 4*60*60 + 7*60)).toEqual('5d 4h 7m');
    });
  });

  describe('roundToApproximateTime', function() {
    it('does not round small numbers', function() {
      expect(idleTimeout._roundToApproximateTime(0)).toEqual(0);
      expect(idleTimeout._roundToApproximateTime(11)).toEqual(11);
      expect(idleTimeout._roundToApproximateTime(99)).toEqual(99);
    });
    it('rounds these values to the nearest minute', function() {
      expect(idleTimeout._roundToApproximateTime(2*60)).toEqual(2*60);
      expect(idleTimeout._roundToApproximateTime(2*60 + 15)).toEqual(2*60);
      expect(idleTimeout._roundToApproximateTime(2*60 + 51)).toEqual(3*60);
      expect(idleTimeout._roundToApproximateTime(19*60 + 11)).toEqual(19*60);
    });
    it('rounds these values to the nearest 5 minutes', function() {
      expect(idleTimeout._roundToApproximateTime(21*60)).toEqual(20*60);
      expect(idleTimeout._roundToApproximateTime(23*60)).toEqual(25*60);
      expect(idleTimeout._roundToApproximateTime(62*60 + 15)).toEqual(60*60);
      expect(idleTimeout._roundToApproximateTime(88*60 + 15)).toEqual(90*60);
    });
    it('rounds these values to the nearest 10 minutes', function() {
      expect(idleTimeout._roundToApproximateTime(96*60)).toEqual(100*60);
      expect(idleTimeout._roundToApproximateTime(133*60)).toEqual(130*60);
      expect(idleTimeout._roundToApproximateTime(148*60)).toEqual(150*60);
    });
    it('rounds these values to the nearest half hour', function() {
      expect(idleTimeout._roundToApproximateTime(3*60*60 + 18*60)).toEqual(3*60*60 + 30*60);
      expect(idleTimeout._roundToApproximateTime(4*60*60 + 12*60)).toEqual(4*60*60);
    });
    it('rounds these values to the nearest hour', function() {
      expect(idleTimeout._roundToApproximateTime(8*60*60 + 38*60)).toEqual(9*60*60);
      expect(idleTimeout._roundToApproximateTime(42*60*60 + 12*60)).toEqual(42*60*60);
    });
    it('rounds these values to the nearest day', function() {
      expect(idleTimeout._roundToApproximateTime(5*24*60*60 + 8*60*60 + 2)).toEqual(5*24*60*60);
    });
  });

});
});
