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

/// <reference path="../../modules/GapiManager.ts" />
/// <reference path="../../modules/TimeoutManager.ts" />

// TODO: look through datalab/static/idle-timeout.js for additional features to port to here.

// TODO: we need to make on-blur work on our tabs so that we stop sending API calls such as
// /api/sessions when a tab is not visible, as that prevents idle timeout.

/**
 * Idle timeout panel.
 * This element provides a timeout icon and a timeout status string.
 * When the icon is clicked, it toggles whether the idle timeout is enabled.
 */
class TimeoutPanel extends Polymer.Element {

  private static _displayInterval = 1000;  // Update display every second
  private static _queryIntervalWhenEnabled = 15 * 1000;  // How often to query when timeout is enabled
  private static _queryIntervalWhenDisabled = 60 * 1000;  // How often to query when timeout is disabled

  private _isOpen: boolean;
  private _lastQueryTime = 0;
  private _timeoutControlsEnabled: boolean;
  private _timeoutEnabled: boolean;
  private _timeoutInfo: common.TimeoutInfo;
  private _timeoutText: string;
  private _updateTimer: number;

  static get is() { return 'timeout-panel'; }

  static get properties() {
    return {
      _timeoutControlsEnabled: {
        type: Boolean,
        value: false,
      },
      _timeoutEnabled: {
        type: Boolean,
        value: false,
      },
      _timeoutText: {
        type: String,
        value: 'waiting for timeout status',
      },
    };
  }

  /**
   * Updates our timeout controls.
   * This should be called when our element becomes visible or hidden.
   * @param open True if our element is visible.
   */
  onOpenChange(isOpen: boolean): Promise<void> {
    this._isOpen = isOpen;
    return this._updateTimeoutInfo();
  }

  _disableTimeout(): Promise<void> {
    console.log('== disabling timeout');
    return TimeoutManager.setTimeoutEnabled(false)
        .then(() => this._updateTimeoutInfo());
  }

  _enableTimeout(): Promise<void> {
    console.log('== enabling timeout');
    return TimeoutManager.setTimeoutEnabled(true)
        .then(() => this._updateTimeoutInfo());
  }

  private _updateTimeoutInfo(): Promise<void> {
    console.log('== updateTimeoutInfo');
    this._lastQueryTime = Date.now();
    return TimeoutManager.getTimeout()
        .then((timeoutInfo) => {
          this._timeoutInfo = timeoutInfo;
          this._updateTimeoutDisplay();
        });
  }

  private _updateTimeoutDisplay(): void {
    const timeoutInfo = this._timeoutInfo;
    // console.log('== updateTimeoutDisplay:', timeoutInfo);
    this._timeoutControlsEnabled = this._isOpen && (timeoutInfo.secondsRemaining > 0);
    this._timeoutEnabled = timeoutInfo.enabled;
    if (this._timeoutEnabled) {
      let secondsRemaining = Math.floor((timeoutInfo.expirationTime - Date.now()) / 1000);
      if (secondsRemaining < 0) {
        secondsRemaining = 0;
      }
      const roundedSecondsRemaining = this._roundToApproximateTime(secondsRemaining);
      const maybeAbout = (roundedSecondsRemaining !== secondsRemaining) ? 'about ' : '';
      this._timeoutText = (roundedSecondsRemaining === 0) ?
          'Idle timeout exceeded' :
          'Idle timeout in ' + maybeAbout + this._secondsToString(roundedSecondsRemaining);
    } else {
      this._timeoutText = 'Idle timeout is disabled';
    }

    this._runTimer();
  }

  // Rounds seconds to an approximate time, based on magnitude.
  // We use rounding instead of truncating so that the user will generally see
  // the number they specified, such as "3h", rather than something like "2h 50m".
  private _roundToApproximateTime(seconds: number): number {
    if (seconds <= 120) {
      return seconds;  // No rounding when less than 2 minutes.
    }
    const minutes = Math.round(seconds / 60);
    if (minutes <= 20) {
      return minutes * 60; // Round to nearest minute when under 20.5 minutes.
    }
    if (minutes <= 60) {
      return Math.round(minutes / 5) * 5 * 60; // Nearest 5 minutes when under 1.5 hour.
    }
    const hours = Math.round(minutes / 60);
    if (hours <= 2) {
      return Math.round(minutes / 10) * 10 * 60; // Nearest 10 minutes when under 2.5 hours.
    }
    if (hours <= 5) {
      return Math.round(minutes / 30) * 30 * 60; // Nearest half hour when under 5.5 hours.
    }
    const days = Math.round(hours / 24);
    if (days <= 3) {
      return hours * 60 * 60; // Nearest hour when under 3.5 days.
    }
    return days * 24 * 60 * 60;     // Nearest day when 3.5 days or more.
  }

  // Converts a number of seconds into a string that include m, h, and d units.
  private _secondsToString(seconds: number): string {
    let s = '';         // build a string
    let t = seconds;    // number of seconds left to convert
    let sep = '';       // separator, gets set to space once s is not null
    if (t > 86400) {
      const days = Math.floor(t / 86400);
      t = t % 86400;
      s = s + sep + days + 'd';
      sep = ' ';
    }
    if (t > 3600) {
      const hours = Math.floor(t / 3600);
      t = t % 3600;
      s = s + sep + hours + 'h';
      sep = ' ';
    }
    if (t > 60) {
      const minutes = Math.floor(t / 60);
      t = t % 60;
      s = s + sep + minutes + 'm';
      sep = ' ';
    }
    if (t > 0) {
      s = s + sep + t + 's';
    }
    return s;
  }

  /**
   * Runs the timer that updates our display and occasionally queries the timeout API.
   */
  private _runTimer() {
    if (this._updateTimer) {
      window.clearTimeout(this._updateTimer);
      this._updateTimer = 0;
    }
    const callback = () => {
      this._updateTimer = 0;
      const queryInterval = this._timeoutEnabled ?
          TimeoutPanel._queryIntervalWhenEnabled : TimeoutPanel._queryIntervalWhenDisabled;
      const now = Date.now();
      const timeSinceLastQuery = now - this._lastQueryTime;
      if (timeSinceLastQuery > queryInterval) {
        this._updateTimeoutInfo();
      } else {
        this._updateTimeoutDisplay();
      }
    };
    this._updateTimer = window.setTimeout(callback, TimeoutPanel._displayInterval);
  }
}

customElements.define(TimeoutPanel.is, TimeoutPanel);
