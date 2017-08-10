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

// TODO: look through datalab/static/idle-timeout.js for additional features to port to here.

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
    return TimeoutManager.setTimeoutEnabled(false)
        .then(() => this._updateTimeoutInfo());
  }

  _enableTimeout(): Promise<void> {
    return TimeoutManager.setTimeoutEnabled(true)
        .then(() => this._updateTimeoutInfo());
  }

  private _updateTimeoutInfo(): Promise<void> {
    this._lastQueryTime = Date.now();
    return TimeoutManager.getTimeout()
        .then((timeoutInfo) => {
          this._timeoutInfo = timeoutInfo;
          this._updateTimeoutDisplay();
        });
  }

  private _updateTimeoutDisplay(): void {
    const timeoutInfo = this._timeoutInfo;
    this._timeoutControlsEnabled = this._isOpen && (timeoutInfo.secondsRemaining > 0);
    this._timeoutEnabled = timeoutInfo.enabled;
    if (this._timeoutEnabled) {
      let secondsRemaining = Math.floor((timeoutInfo.expirationTime - Date.now()) / 1000);
      if (secondsRemaining < 0) {
        secondsRemaining = 0;
      }
      const roundedSecondsRemaining = TimeoutManager.roundToApproximateTime(secondsRemaining);
      const maybeAbout = (roundedSecondsRemaining !== secondsRemaining) ? 'about ' : '';
      this._timeoutText = (roundedSecondsRemaining === 0) ?
          'Idle timeout exceeded' :
          'Idle timeout in ' + maybeAbout + TimeoutManager.secondsToString(roundedSecondsRemaining);
    } else {
      this._timeoutText = 'Idle timeout is disabled';
    }

    this._runTimer();
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
