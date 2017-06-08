define(() => {
  // Generate an absolute link to a path on this same Datalab instance.
  function datalabLink(fullPath) {
    var basePath = document.body.getAttribute('data-base-url');
    if (fullPath.indexOf('/') == 0) {
      fullPath = basePath + fullPath.slice(1);
    }
    return window.location.protocol + '//' + window.location.host + fullPath;
  }

  // Return the portion of the given full path that is
  // relative to the Datalab base path.
  function datalabSubPath(fullPath) {
    var basePath = document.body.getAttribute('data-base-url');
    if (fullPath.indexOf(basePath) == 0) {
      return '/' + fullPath.slice(basePath.length);
    }
    return fullPath;
  }

  const debug = {
    log: function() {
      if (window.location.search.indexOf('debug=true') > -1) {
        console.log.apply(console, arguments);
      }
    },
  };

  function reportEvent(event) {
    var reportingEnabled = (document.body.getAttribute('data-reporting-enabled') == 'true');
    if (!reportingEnabled) { return; }

    var signedIn = (document.body.getAttribute('data-signed-in') == 'true');
    var additionalMetadata = 'signedIn=' + signedIn;
    if (event['metadata']) {
      event['metadata'] = event['metadata'] + ',' + additionalMetadata;
    } else {
      event['metadata'] = additionalMetadata;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(event);
  }

  // Sends an XMLHttpRequest to the specified URL.
  // Options can contain the following fields:
  //   method: The HTTP method to use; default is 'GET'
  //   errorCallback: A function to call if the XHR completes
  //       with a status other than 200
  function xhr(url, callback, options) {
    options = options || {};
    const method = options.method || 'GET';

    let request = new XMLHttpRequest();
    request.onreadystatechange = function() {
      if (request.readyState === 4) {
        if (request.status === 200) {
          if (callback) {
            callback.call(request);
          }
        } else {
          if (options.errorCallback) {
            options.errorCallback.call(request);
          }
        }
      }
    }
    request.open(method, url);
    request.send();
  }

  return {
    datalabLink,
    datalabSubPath,
    debug,
    reportEvent,
    xhr,
  };
});
