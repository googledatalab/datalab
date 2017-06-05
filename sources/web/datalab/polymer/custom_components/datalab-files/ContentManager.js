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

  static filesApiUrl() {
    return '/api/contents';
  }

  static sessionsApiUrl() {
    return '/api/sessions';
  }

  /**
   * Returns a list of files at the target path
   * A file has the following interface: {
   *   content,
   *   created,
   *   format,
   *   last_modified,
   *   mimetype,
   *   name,
   *   path,
   *   status,
   *   type,
   *   writable
   * }
   * Two requests are made to /api/contents and /api/sessions to get this data
   */
  static listFilesAsync(path) {
    const filesPromise = new Promise((resolve, reject) => {
      xhr(this.filesApiUrl() + path,
          request => {
            try {
              let files = JSON.parse(request.response).content;
              resolve(files);
            } catch(e) {
              reject('Received bad format from endpoint: ' + this.filesApiUrl());
            }
          },
          {errorCallback: error => {
            reject('Could not get list of files at: ' + path);
          }}
      );
    });

    const sessionsPromise = new Promise((resolve, reject) => {
      xhr(this.sessionsApiUrl(),
          request => {
            try {
              let sessions = JSON.parse(request.response);
              resolve(sessions);
            } catch(e) {
              reject('Received bad format from endpoint: ' + this.sessionsApiUrl());
            }
          },
          {errorCallback: error => {
            reject('Error contacting endpoint: ' + this.sessionsApiUrl());
          }}
      );
    });

    // combine the return values of the two requests to supplement the files
    // array with the status value
    return Promise.all([filesPromise, sessionsPromise])
      .then(values => {
        let files = values[0];
        const sessions = values[1];
        let runningPaths = [];
        sessions.forEach(session => {
          runningPaths.push(session.notebook.path);
        });
        files.forEach(file => {
          file.status = runningPaths.indexOf(file.path) > -1 ? 'running' : '';
        });
        return files;
      });
  }
}
