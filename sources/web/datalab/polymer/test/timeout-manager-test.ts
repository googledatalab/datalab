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

describe('<timeout-manager>', () => {

  describe('roundToApproximateTime', () => {
    it('does not round small numbers', () => {
      assert(TimeoutManager.roundToApproximateTime(0) === 0, '');
      assert(TimeoutManager.roundToApproximateTime(11) === 11, '');
      assert(TimeoutManager.roundToApproximateTime(99) === 99, '');
    });
    it('rounds these values to the nearest minute', () => {
      assert(TimeoutManager.roundToApproximateTime(2 * 60) === 2 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(2 * 60 + 15) === 2 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(2 * 60 + 51) === 3 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(19 * 60 + 11) === 19 * 60, '');
    });
    it('rounds these values to the nearest 5 minutes', () => {
      assert(TimeoutManager.roundToApproximateTime(21 * 60) === 20 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(23 * 60) === 25 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(62 * 60 + 15) === 60 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(88 * 60 + 15) === 90 * 60, '');
    });
    it('rounds these values to the nearest 10 minutes', () => {
      assert(TimeoutManager.roundToApproximateTime(96 * 60) === 100 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(133 * 60) === 130 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(148 * 60) === 150 * 60, '');
    });
    it('rounds these values to the nearest half hour', () => {
      assert(TimeoutManager.roundToApproximateTime(3 * 60 * 60 + 18 * 60) === 3 * 60 * 60 + 30 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(4 * 60 * 60 + 12 * 60) === 4 * 60 * 60, '');
    });
    it('rounds these values to the nearest hour', () => {
      assert(TimeoutManager.roundToApproximateTime(8 * 60 * 60 + 38 * 60) === 9 * 60 * 60, '');
      assert(TimeoutManager.roundToApproximateTime(42 * 60 * 60 + 12 * 60) === 42 * 60 * 60, '');
    });
    it('rounds these values to the nearest day', () => {
      assert(TimeoutManager.roundToApproximateTime(5 * 24 * 60 * 60 + 8 * 60 * 60 + 2) === 5 * 24 * 60 * 60, '');
    });
  });

  describe('secondsToString', () => {
    it('converts zero and negative to empy string', () => {
      assert(TimeoutManager.secondsToString(0) === '', '');
      assert(TimeoutManager.secondsToString(-1) === '', '');
    });
    it('converts single-unit strings correctly', () => {
      assert(TimeoutManager.secondsToString(1) === '1s', '');
      assert(TimeoutManager.secondsToString(15) === '15s', '');
      assert(TimeoutManager.secondsToString(2 * 60) === '2m', '');
      assert(TimeoutManager.secondsToString(4 * 60 * 60) === '4h', '');
      assert(TimeoutManager.secondsToString(3 * 24 * 60 * 60) === '3d', '');
    });
    it('converts multi-unit strings correctly', () => {
      assert(TimeoutManager.secondsToString(60 + 5) === '1m 5s', '');
      assert(TimeoutManager.secondsToString(1 * 60 * 60 + 30) === '1h 30s', '');
      assert(TimeoutManager.secondsToString(3 * 60 * 60 + 10 * 60 + 25) === '3h 10m 25s', '');
      assert(TimeoutManager.secondsToString(5 * 24 * 60 * 60 + 4 * 60 * 60 + 7 * 60) === '5d 4h 7m', '');
    });
  });

});
