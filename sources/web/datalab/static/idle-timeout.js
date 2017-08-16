define(['base/js/dialog', 'base/js/events', 'util'], function(dialog, events, util) {
  const updateTimeoutInfoInterval = 1000; // Update display every second while the user is watching.
  const updateTimeoutInfoNoDisplayInterval = 60 * 1000; // Keep tabs on timeout info even when not being displayed.
  const queryTimeoutInfoInterval = 10 * 1000; // Send a query every ten seconds while the user is watching.
  const queryTimeoutInfoNoDisplayInterval = 30 * 1000; // Send a query less often when not being displayed.
  const kernelBusyHeartbeatInterval = 20 * 1000;  // When the kernel is busy, send heartbeat every 20 seconds.
  const minResetInterval = 5 * 1000;  // Don't send a reset request more often than this.

  let timeoutInfoTimeout;     // Result of setTimeout for calling updateTimeoutInfo
  let timeoutInfo = {};
  let lastUpdateTimeoutTime = 0;

  // Sets event handlers to deal with kernel-busy heartbeats.
  function setupKernelBusyHeartbeat() {
    events.on('kernel_busy.Kernel', function() {
      util.debug.log('kernel_busy event received');
      _runBusyTimer();
    });
    events.on('kernel_idle.Kernel', function() {
      util.debug.log('kernel_idle event received');
      _clearBusyTimer();
      _maybeResetIdleTimeout();
    });
  }

  // Sets an event handler to deal with kernel-disconnected events.
  function setupDisconnectHandler() {
    events.on('kernel_connection_failed.Kernel', function() {
      util.debug.log('Disconnected; timeoutInfo:');
      util.debug.log(timeoutInfo);
      _alertIfTimedOutAndDisable();
    });
  }

  function _alertIfTimedOutAndDisable() {
    if (timeoutInfo.enabled && timeoutInfo.idleTimeoutSeconds > 0) {
      const secondsRemaining = Math.floor((timeoutInfo.expirationTime - Date.now()) / 1000);
      if (secondsRemaining <=1 ) {
        // If there are other handlers, let them run first.
        const delayToLetOtherHandlersRun = 2 * 1000;
        window.setTimeout(_alertIdleShutdown, delayToLetOtherHandlersRun);
      }
    }
    timeoutInfo.enabled = false;  // Make sure we don't get a false indication later.
  }

  // Alerts the user that there was a shutdown due to idle time exceeded.
  function _alertIdleShutdown() {
    util.debug.log('Idle timeout exceeded');
    const shutdownMsg = ('The datalab server shut down after exceeding the idle timeout of ' +
        _secondsToString(timeoutInfo.idleTimeoutSeconds) +
        '.\nUse the "datalab connect" command to restart it and reconnect.' +
        '\nNotebooks are auto-saved periodically to a persistent disk and are available after reconnecting.');
    dialog.modal({
      title: 'Idle timeout exceeded',
      body: shutdownMsg,
      buttons: { 'Close': {} },
      keyboard_manager: IPython.keyboard_manager,
    });
    timeoutInfo.enabled = false;  // Don't show this message more than once.
  }

  // Initializes the idle-timeout mechanism.
  function setupTimeoutTimer() {
    updateTimeoutInfo(undefined);
  }

  // Updates the display of timeout info in the dropdown menu.
  // Assumes global timeoutInfo has been set.
  function _updateTimeoutDisplay(dropdown) {
    if (!dropdown) {
      util.debug.log('updateTimeoutDisplay no dropdown');
      return;
    }
    util.debug.log('updating timeout display');
    util.debug.log(dropdown);
    if (timeoutInfo.enabled) {
      let secondsRemaining = Math.floor((timeoutInfo.expirationTime - Date.now()) / 1000);
      if (secondsRemaining < 0) {
        secondsRemaining = 0;
      }
      const roundedSecondsRemaining = _roundToApproximateTime(secondsRemaining);
      const maybeAbout = (roundedSecondsRemaining != secondsRemaining)?'about ':'';
      const details = (roundedSecondsRemaining == 0) ?
        'Idle timeout exceeded' :
        'Idle timeout in ' + maybeAbout + _secondsToString(roundedSecondsRemaining);
      dropdown.find('#idleTimeoutDetails').html(details);
      util.debug.log('show enabled button');
      dropdown.find('#idleTimeoutEnabledButton').show();
      dropdown.find('#idleTimeoutDisabledButton').hide();
    } else if (!timeoutInfo.idleTimeoutSeconds) {
      // There is no idle timeout interval, so timeout can't be enabled in the
      // UI, so we show nothing at all.
      util.debug.log('no idleTimeoutSeconds');
      dropdown.find('#idleTimeoutEnabledButton').hide();
      dropdown.find('#idleTimeoutDisabledButton').hide();
    } else {
      util.debug.log('show disabled button');
      dropdown.find('#idleTimeoutEnabledButton').hide();
      dropdown.find('#idleTimeoutDisabledButton').show();
    }
  }

  // Sets a timer to run updateTimeoutInfo.
  function _setUpdateTimeoutInfoTimeout(dropdown) {
    const interval = (dropdown && dropdown.hasClass('open')) ?
        updateTimeoutInfoInterval : updateTimeoutInfoNoDisplayInterval;
    if (timeoutInfoTimeout) {
      window.clearTimeout(timeoutInfoTimeout);
    }
    timeoutInfoTimeout = window.setTimeout(() => {
        updateTimeoutInfo(dropdown);
    }, interval);
  }

  // Queries the server for the timeout info and then updates the display,
  // or just updates the display if not enough time has passed to call the
  // service again.
  function updateTimeoutInfo(dropdown) {
    const interval = (dropdown && dropdown.hasClass('open')) ?
        queryTimeoutInfoInterval : queryTimeoutInfoNoDisplayInterval;
    const now = Date.now();
    if (now - lastUpdateTimeoutTime > interval) {
      util.debug.log('Querying timeout');
      const timeoutInfoUrl = util.datalabLink("/_timeout");
      function callback() {
        util.debug.log('_timeout call response:');
        util.debug.log(this);
        lastUpdateTimeoutTime = Date.now();
        const result = this.response; // 'this' is the XHR
        timeoutInfo = JSON.parse(result) || {};
        timeoutInfo.expirationTime = Date.now() + timeoutInfo.secondsRemaining * 1000;
        _updateTimeoutDisplay(dropdown);
        _setUpdateTimeoutInfoTimeout(dropdown);
      }
      function errorHandler() {
        util.debug.log('xhr error response:');
        util.debug.log(this);
        const status = this.status;   // 'this' is the XHR
        util.debug.log('status=' + status);
        if (status == 0) {    // We get 0 when we lost our connection to the server.
          _alertIfTimedOutAndDisable();
        }
      }
      const xhrOptions = {
        errorCallback: errorHandler
      };
      util.xhr(timeoutInfoUrl, callback, xhrOptions);
    } else {
      // Too soon to query, just run the clock locally.
      _updateTimeoutDisplay(dropdown);
      _setUpdateTimeoutInfoTimeout(dropdown);
    }
  }

  // Sends a message to the server to enable or disable the timout.
  function toggleIdleTimeout() {
    const newValue = timeoutInfo.enabled ? "false" : "true";
    const timeoutUrl = util.datalabLink("/_timeout?enabled=" + newValue);
    const dropdown = $(this).parent().parent().parent();  // Walk up to the account drop-down.
    util.debug.log('Changing enabled to ' + newValue);
    updateTimeoutInfo(dropdown);
    util.xhr(timeoutUrl, () => {
      timeoutInfo.enabled = newValue;   // Display the new value right away.
      lastUpdateTimeoutTime = 0;
      updateTimeoutInfo(dropdown);
    }, {method: 'POST'});
  }

  // Rounds seconds to an approximate time, based on magnitude.
  // We use rounding instead of truncating so that the user will generally see
  // the number they specified, such as "3h", rather than something like "2h 50m".
  function _roundToApproximateTime(seconds) {
    if (seconds <= 120) return seconds;  // No rounding when less than 2 minutes.
    const minutes = Math.round(seconds / 60);
    if (minutes <= 20) return minutes * 60; // Round to nearest minute when under 20.5 minutes.
    if (minutes <= 60) return Math.round(minutes / 5) * 5 * 60; // Nearest 5 minutes when under 1.5 hour.
    const hours = Math.round(minutes / 60);
    if (hours <= 2) return Math.round(minutes / 10) * 10 * 60; // Nearest 10 minutes when under 2.5 hours.
    if (hours <= 5) return Math.round(minutes / 30) * 30 * 60; // Nearest half hour when under 5.5 hours.
    const days = Math.round(hours / 24);
    if (days <= 3) return hours * 60 * 60; // Nearest hour when under 3.5 days.
    return days * 24 * 60 * 60;     // Nearest day when 3.5 days or more.
  }

  // Converts a number of seconds into a string that include m, h, and d units.
  function _secondsToString(seconds) {
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

  // Set up our mechanism to keep the idle timer reset
  // while our kernel is busy.
  let lastIdleTimeoutReset = 0;
  let busyTimer;

  function _clearBusyTimer() {
    if (busyTimer) {
      window.clearTimeout(busyTimer);
    }
    busyTimer = null;
  }

  function _runBusyTimer() {
    util.debug.log('runBusyTimer');
    _clearBusyTimer();
    _maybeResetIdleTimeout();
    busyTimer = window.setTimeout(_runBusyTimer, kernelBusyHeartbeatInterval);
  }

  function _maybeResetIdleTimeout() {
    util.debug.log('request to reset idle timeout');
    now = Date.now();
    if ((now - lastIdleTimeoutReset) > minResetInterval) {
      _resetIdleTimeout();
      lastIdleTimeoutReset = now;
    }
  }

  function _resetIdleTimeout() {
    const timeoutUrl = util.datalabLink("/_timeout?reset=true");
    util.debug.log('reset idle timeout');
    util.xhr(timeoutUrl, null, {method: 'POST'});
  }

  function notebookScrolled() {
    util.debug.log('got scroll event on notebook');
    _maybeResetIdleTimeout();
  }

  return {
    notebookScrolled,
    setupDisconnectHandler,
    setupKernelBusyHeartbeat,
    setupTimeoutTimer,
    toggleIdleTimeout,
    updateTimeoutInfo,

    _roundToApproximateTime,
    _secondsToString,
  };
});
