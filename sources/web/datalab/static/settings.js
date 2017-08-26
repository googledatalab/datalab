define(['idle-timeout', 'util'], (idleTimeout, util) => {
  function getSettingsAddress() {
    return util.datalabLink("/_usersettings");
  }

  function getSettingKeyAddress(setting) {
    return util.datalabLink("/_usersettings?key=" + setting);
  }

  function init() {
    // Prepare the theme selector radio boxes
    const lightThemeRadioOption = document.getElementById("lightThemeRadioOption");
    const darkThemeRadioOption = document.getElementById("darkThemeRadioOption");

    // Prepare the timeout box
    const idleTimeoutTextBox = document.getElementById("idleTimeoutIntervalTextBox");
    const idleTimeoutUpdateButton = document.getElementById("idleTimeoutUpdateButton");
    const idleTimeoutErrorLabel = document.getElementById("idleTimeoutErrorLabel");

    // By default, check the light theme radio button
    // TODO: When we have support for default settings on server side, remove this
    lightThemeRadioOption.checked = true;
    darkThemeRadioOption.checked = false;

    // Load the actual settings and populate the dialog
    util.xhr(getSettingsAddress(), function() {
      const settings = JSON.parse(this.responseText);
      lightThemeRadioOption.checked = (settings.theme === "light") || !settings.theme;
      darkThemeRadioOption.checked = settings.theme === "dark";
      idleTimeoutTextBox.value = settings.idleTimeoutInterval;
    });

    lightThemeRadioOption.onclick = function() {
      setTheme("light");
      darkThemeRadioOption.checked = false;
    };
    darkThemeRadioOption.onclick = function() {
      setTheme("dark");
      lightThemeRadioOption.checked = false;
    };

    idleTimeoutTextBox.onkeyup = function() {
      const newValue = idleTimeoutTextBox.value;
      const dryRun = true;
      setIdleTimeout(newValue, idleTimeoutUpdateButton, idleTimeoutErrorLabel, dryRun);
    };
    idleTimeoutUpdateButton.onclick = function() {
      const newValue = idleTimeoutTextBox.value;
      const dryRun = false;
      setIdleTimeout(newValue, idleTimeoutUpdateButton, idleTimeoutErrorLabel, dryRun);
    };
  }

  function setTheme(theme) {
    util.xhr(getSettingKeyAddress("theme") + "&value=" + theme, function() {
      // Reload the stylesheet by resetting its address with a random (time) version querystring
      sheetAddress = document.getElementById("themeStylesheet").href + "?v=" + Date.now()
      document.getElementById("themeStylesheet").setAttribute('href', sheetAddress);
    }, {method: 'POST'});
  }

  function setIdleTimeout(interval, button, errorLabel, dryRun) {
    button.disabled = true;   // disable until we know the syntax is OK
    errorLabel.innerText = '';
    const onOk = function() {
      button.disabled = false;
      idleTimeout.updateTimeoutInfo();
      if (!dryRun) {
        errorLabel.innerText = 'Idle timeout updated to ' + interval;
      }
    };
    const onError = function() {
      errorLabel.innerText = this.responseText;
    };
    const xhrUrl = getSettingKeyAddress("idleTimeoutInterval") +
        "&value=" + interval +
        (dryRun? "&dryRun=true" : "");
    const xhrOptions = {
      method: 'POST',
      errorCallback: onError,
    };
    util.xhr(xhrUrl, onOk, xhrOptions);
  }

  return {
    init: init,
  };
});
