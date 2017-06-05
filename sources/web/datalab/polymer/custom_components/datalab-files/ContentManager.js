// Sends an XMLHttpRequest to the specified URL.
// Options can contain the following fields:
//   method: The HTTP method to use; default is 'GET'
//   errorCallback: A function to call if the XHR completes
//       with a status other than 200
function xhr(url, callback, options) {
  options = options || {};
  const method = options.method || 'GET';

  const request = new XMLHttpRequest();
  request.onreadystatechange = function() {
    if (request.readyState === 4) {
      if (request.status === 200) {
        if (callback) {
          callback(request);
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

class ContentManager {

  static apiUrl() {
    return '/api/contents';
  }

  static listFilesAsync(path) {
    const listPromise = new Promise((resolve, reject) => {
      xhr(this.apiUrl() + path,
          request => {
            resolve(request.response);
          },
          error => {
            reject('Could not contact endpoint: ' + this.apiUrl());
          }
      );
    });

    return listPromise;
  }
}
