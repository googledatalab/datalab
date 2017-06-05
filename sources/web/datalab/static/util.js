define(() => {
  const debug = {
    enabled: true,
    log: function() { console.log.apply(console, arguments); },
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
    debug,
    reportEvent,
    xhr,
  };
});
