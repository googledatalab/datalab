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
 * This file contains a collection of functions that call the Jupyter server APIs, and are
 * wrapped in the ApiManager class. It also defines a set of interfaces to interact with
 * these APIs to help with type checking.
 */

/**
 * Represents a file object as returned from Jupyter's files API.
 */
interface JupyterFile {
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
 * Represents an augmented version of a file obect that contains extra metadata.
 */
interface ApiFile extends JupyterFile {
  status: string
}

/**
 * Represents a session object as returned from Jupyter's sessions API.
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

/** Options for _xhr call, contains the following optional fields:
 *  - method: The HTTP method to use; default is 'GET'.
 *  - errorCallback: A function to call if the XHR completes
 *      with a status other than 200.
 */
interface XhrOptions {
  method?: string,
  errorCallback?: Function,
  postParameters?: string,
  successCode?: number,
}

/**
 * Handles different API calls to the backend notebooks server and Jupyter instance.
 */
class ApiManager {

  /**
   * URL for querying files
   */
  static readonly contentApiUrl = '/api/contents';

  /**
   * URL for querying sessions
   */
  static readonly sessionsApiUrl = '/api/sessions';

  /**
   * Returns a list of currently running sessions, each implementing the Session interface
   */
  static listSessionsAsync(): Promise<Array<Session>> {
    return new Promise((resolve, reject) => {
      ApiManager._xhr(this.sessionsApiUrl,
          (request: XMLHttpRequest) => {
            try {
              let sessions = JSON.parse(request.response);
              resolve(sessions);
            } catch(e) {
              reject('Received bad format from endpoint: ' + this.sessionsApiUrl);
            }
          },
          {
            errorCallback: () => {
              reject('Error contacting endpoint: ' + this.sessionsApiUrl);
            }
          }
      );
    });
  }

  /**
   * Returns a list of files at the target path, each implementing the ApiFile interface.
   * Two requests are made to /api/contents and /api/sessions to get this data.
   */
  static listFilesAsync(path: string): Promise<Array<ApiFile>> {
    const filesPromise: Promise<Array<JupyterFile>> = new Promise((resolve, reject) => {
      ApiManager._xhr(this.contentApiUrl + path,
          (request: XMLHttpRequest) => {
            try {
              let files = JSON.parse(request.response).content;
              resolve(files);
            } catch(e) {
              reject('Received bad format from endpoint: ' + this.contentApiUrl);
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

    // Combine the return values of the two requests to supplement the files
    // array with the status value.
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

  static createNewItem(type: string) {
    return new Promise((resolve, reject) => {
      ApiManager._xhr(ApiManager.contentApiUrl,
          (request: XMLHttpRequest) => {
            const newNotebook = JSON.parse(request.responseText);
            resolve(newNotebook);
          },
          {
            method: 'POST',
            postParameters: JSON.stringify({
              type: type,
              ext: 'ipynb'
            }),
            errorCallback: (e: object) => {
              console.log(e);
              reject();
            },
            successCode: 201,
          });
    });
  }

  static renameItem(oldPath: string, newPath: string) {
    return new Promise((resolve, reject) => {
      ApiManager._xhr(ApiManager.contentApiUrl + '/' + oldPath,
          () => {
            resolve();
          },
          {
            method: 'PATCH',
            postParameters: JSON.stringify({
              path: newPath
            }),
            errorCallback: (e: object) => {
              console.log(e);
              reject();
            },
          });
    });
  }

  /**
   * Sends an XMLHttpRequest to the specified URL
   */
  static _xhr(url: string, callback: Function, options: XhrOptions) {
    options = options || {};
    const method = options.method || 'GET';
    const params = options.postParameters;
    const successCode = options.successCode || 200;

    const request = new XMLHttpRequest();
    request.onreadystatechange = function() {
      if (request.readyState === 4) {
        if (request.status === successCode) {
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
    request.send(params);
  }

}

