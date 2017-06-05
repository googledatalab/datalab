define(['util'], (util) => {
  function getSettingKeyAddress(setting) {
    return window.location.protocol + "//" + window.location.host + "/_settings?key=" + setting;
  }

  function init() {
    // Prepare the theme selector radio boxes
    lightThemeRadioOption = document.getElementById("lightThemeRadioOption")
    darkThemeRadioOption = document.getElementById("darkThemeRadioOption")

    // By default, check the light theme radio button
    // TODO: When we have support for default settings on server side, remove this
    lightThemeRadioOption.checked = true;
    darkThemeRadioOption.checked = false;
    util.xhr(getSettingKeyAddress("theme"), function() {
      lightThemeRadioOption.checked = this.responseText === "\"light\"";
      darkThemeRadioOption.checked = this.responseText === "\"dark\"";
    });
    lightThemeRadioOption.onclick = function() {
      setTheme("light");
      darkThemeRadioOption.checked = false;
    };
    darkThemeRadioOption.onclick = function() {
      setTheme("dark");
      lightThemeRadioOption.checked = false;
    };
  }

  function setTheme(theme) {
    util.xhr(getSettingKeyAddress("theme") + "&value=" + theme, function() {
      // Reload the stylesheet by resetting its address with a random (time) version querystring
      sheetAddress = document.getElementById("themeStylesheet").href + "?v=" + Date.now()
      document.getElementById("themeStylesheet").setAttribute('href', sheetAddress);
    }, {method: 'POST'});
  }

  return {
    init: init,
  };
});
