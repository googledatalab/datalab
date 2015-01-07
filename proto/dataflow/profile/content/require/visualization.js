define(function() {
  'use strict';

  // Queued packages to load until the google api loader itself has not been loaded.
  var queue = {
    packages: [],
    callbacks: []
  };

  function loadGoogleApiLoader(callback) {
    // Visualization packages are loaded using the Google loader.
    // The loader URL itself must contain a callback (by name) that it invokes when its loaded.
    var callbackName = '__googleApiLoaderCallback';
    window[callbackName] = callback;

    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = '//www.google.com/jsapi?callback=' + callbackName;
    document.getElementsByTagName('head')[0].appendChild(script);
  }

  function invokeVisualizationCallback(cb) {
    cb(google.visualization);
  }

  function loadVisualizationPackages(names, callbacks) {
    if (names.length) {
      var visualizationOptions = {
        packages: names,
        callback: function() { callbacks.forEach(invokeVisualizationCallback); }
      };

      google.load('visualization', '1', visualizationOptions);
    }
  }

  loadGoogleApiLoader(function() {
    if (queue) {
      loadVisualizationPackages(queue.packages, queue.callbacks);
      queue = null;
    }
  });

  return {
    load: function load(name, req, callback, config) {
      if (config.isBuild) {
        loadCallback(null);
      }
      else {
        if (queue) {
          // Queue the package and associated callback to load, once the loader has been loaded.
          queue.packages.push(name);
          queue.callbacks.push(callback);
        }
        else {
          // Loader has already been loaded, so go ahead and load the specified package.
          loadVisualizationPackages([ name ], [ callback ]);
        }
      }
    }
  }
});
