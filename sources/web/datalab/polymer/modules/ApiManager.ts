/// <reference path='../../../../../third_party/externs/ts/imd/imd.d.ts' />

define('ApiManager', () => {

  /**
   * Represents a file object as returned from Jupyter's files API
   */
  interface File {
    content: string,
    created: string,
    format: string,
    last_modified: string,
    mimetype: string,
    name: string,
    path: string,
    type: string,
    writable: boolean
  }

  /**
   * Represents an augmented version of a file obect that contains extra metadata
   */
  interface ApiFile extends File {
    status: string
  }

  /**
   * Represents a session object as returned from Jupyter's sessions API
   */
  interface Session {
    id: string,
    kernel: {
      id: string,
      name: string
    },
    notebook: {
      path: string
    }
  }

  /** Options for _xhr call, can contain the following fields:
   *  method: The HTTP method to use; default is 'GET'
   *  errorCallback: A function to call if the XHR completes
   *    with a status other than 200
   */
  interface XhrOptions {
    method?: string,
    errorCallback?: Function
  }

  /**
   * Handles different API calls to the backend notebooks server and Jupyter instance
   */
  class ApiManager {

    /**
     * URL for querying files
     */
    static filesApiUrl() {
      return '/api/contents';
    }

    /**
     * URL for querying sessions
     */
    static sessionsApiUrl() {
      return '/api/sessions';
    }

    /**
     * Returns a list of currently running sessions, each implementing the Session interface
     */
    static listSessionsAsync() {
      return new Promise((resolve, reject) => {
        ApiManager._xhr(this.sessionsApiUrl(),
            (request: XMLHttpRequest) => {
              try {
                let sessions = JSON.parse(request.response);
                resolve(sessions);
              } catch(e) {
                reject('Received bad format from endpoint: ' + this.sessionsApiUrl());
              }
            },
            {
              errorCallback: () => {
                reject('Error contacting endpoint: ' + this.sessionsApiUrl());
              }
            }
        );
      });
    }

    /**
     * Returns a list of files at the target path, each implementing the ApiFile interface.
     * Two requests are made to /api/contents and /api/sessions to get this data
     */
    static listFilesAsync(path: string) {
      const filesPromise: Promise<Array<File>> = new Promise((resolve, reject) => {
        ApiManager._xhr(this.filesApiUrl() + path,
            (request: XMLHttpRequest) => {
              try {
                let files = JSON.parse(request.response).content;
                resolve(files);
              } catch(e) {
                reject('Received bad format from endpoint: ' + this.filesApiUrl());
              }
            },
            {
              errorCallback: () => {
                reject('Could not get list of files at: ' + path);
              }
            }
        );
      });

      const sessionsPromise: Promise<Array<Session>> = ApiManager.listSessionsAsync();

      // combine the return values of the two requests to supplement the files
      // array with the status value
      return Promise.all([filesPromise, sessionsPromise])
        .then(values => {
          let files = values[0];
          const sessions = values[1];
          let runningPaths: Array<string> = [];
          sessions.forEach(session => {
            runningPaths.push(session.notebook.path);
          });
          files.forEach(file => {
            (<ApiFile>file).status = runningPaths.indexOf(file.path) > -1 ? 'running' : '';
          });
          return files;
        });
    }

    // Sends an XMLHttpRequest to the specified URL.
    static _xhr(url: string, callback: Function, options: XhrOptions) {
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

  }

  return ApiManager;

});
