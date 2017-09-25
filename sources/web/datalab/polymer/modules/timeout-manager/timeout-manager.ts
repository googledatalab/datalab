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

/**
 * Handles API calls related to idle timeout.
 */
class TimeoutManager {

  private static _hoursPerDay = 24;
  private static _minutesPerHour = 60;
  private static _secondsPerMinute = 60;
  private static _secondsPerHour = TimeoutManager._secondsPerMinute * TimeoutManager._minutesPerHour;
  private static _secondsPerDay = TimeoutManager._secondsPerHour * TimeoutManager._hoursPerDay;

  /**
   * Queries the server for the timeout info.
   */
  public static getTimeout(): Promise<common.TimeoutInfo> {
    return ApiManager.sendRequestAsync(ApiManager.getServiceUrl(ServiceId.TIMEOUT))
        .then((timeoutInfo) => {
          timeoutInfo.expirationTime = (timeoutInfo.idleTimeoutSeconds > 0) ?
            Date.now() + timeoutInfo.secondsRemaining * 1000 : 0;
          return timeoutInfo;
        });
  }

  /**
   * Enables or disables idle timeout.
   */
   public static setTimeoutEnabled(enabled: boolean): Promise<string> {
    const timeoutUrl = ApiManager.getServiceUrl(ServiceId.TIMEOUT) + '?enabled=' + enabled;
    const xhrOptions: XhrOptions = {
      method: 'POST',
    };
    return ApiManager.sendTextRequestAsync(timeoutUrl, xhrOptions);
  }

  /**
   * Rounds seconds to an approximate time, based on magnitude.
   * We use rounding instead of truncating so that the user will generally see
   * the number they specified, such as "3h", rather than something like "2h 50m".
   */
  public static roundToApproximateTime(seconds: number): number {
    if (seconds <= 2 * TimeoutManager._secondsPerMinute) {
      return seconds;  // No rounding when less than 2 minutes.
    }
    const minutes = Math.round(seconds / TimeoutManager._secondsPerMinute);
    if (minutes <= 20) {
      // Round to nearest minute when under 20.5 minutes.
      return minutes * TimeoutManager._secondsPerMinute;
    }
    if (minutes <= 60) {
      // Round to nearest 5 minutes when under 1.5 hour.
      return Math.round(minutes / 5) * 5 * TimeoutManager._secondsPerMinute;
    }
    const hours = Math.round(minutes / TimeoutManager._secondsPerMinute);
    if (hours <= 2) {
      // Round to nearest 10 minutes when under 2.5 hours.
      return Math.round(minutes / 10) * 10 * TimeoutManager._secondsPerMinute;
    }
    if (hours <= 5) {
      // Round to nearest half hour when under 5.5 hours.
      return Math.round(minutes / 30) * 30 * TimeoutManager._secondsPerMinute;
    }
    const days = Math.round(hours / TimeoutManager._hoursPerDay);
    if (days <= 3) {
      // Round to nearest hour when under 3.5 days.
      return hours * TimeoutManager._secondsPerHour;
    }
    // Round to nearest day when 3.5 days or more.
    return days * TimeoutManager._secondsPerDay;
  }

  /**
   * Converts a number of seconds into a string that include m, h, and d units.
   */
  public static secondsToString(seconds: number): string {
    let s = '';         // build a string
    let t = seconds;    // number of seconds left to convert
    let sep = '';       // separator, gets set to space once s is not null
    if (t > TimeoutManager._secondsPerDay) {
      const days = Math.floor(t / TimeoutManager._secondsPerDay);
      t = t % TimeoutManager._secondsPerDay;
      s = s + sep + days + 'd';
      sep = ' ';
    }
    if (t > TimeoutManager._secondsPerHour) {
      const hours = Math.floor(t / TimeoutManager._secondsPerHour);
      t = t % TimeoutManager._secondsPerHour;
      s = s + sep + hours + 'h';
      sep = ' ';
    }
    if (t > TimeoutManager._secondsPerMinute) {
      const minutes = Math.floor(t / TimeoutManager._secondsPerMinute);
      t = t % TimeoutManager._secondsPerMinute;
      s = s + sep + minutes + 'm';
      sep = ' ';
    }
    if (t > 0) {
      s = s + sep + t + 's';
    }
    return s;
  }
}
