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

/// <reference path="../../common.d.ts" />

/**
 * Represents a cell in a Jupyter notebook.
 */
interface JupyterNotebookCellModel {
  cell_type: string;
  execution_count: number;
  metadata: object;
  outputs: string[];
  source: string;
}

/**
 * Represents a Jupyter notebook model.
 */
interface JupyterNotebookModel {
  cells: JupyterNotebookCellModel[];
  metadata: object;
  nbformat: number;
  nbformat_minor: number;
}

/**
 * Represents a file object as returned from Jupyter's files API.
 */
interface JupyterFile {
  content: JupyterFile[] | JupyterNotebookModel | string;
  created?: string;
  format: string;
  last_modified?: string;
  mimetype?: string;
  name: string;
  path: string;
  type: string;
  writable?: boolean;
}

/**
 * Represents a Jupyter terminal object.
 */
interface JupyterTerminal {
  name: string;
}

/**
 * Represents an augmented version of a file obect that contains extra metadata.
 */
interface ApiFile extends JupyterFile {
  status: string;
}

/**
 * Represents a session object as returned from Jupyter's sessions API.
 */
interface Session {
  id: string;
  kernel: {
    id: string;
    name: string;
  };
  notebook: {
    path: string;
  };
}

/**
 * Options for _xhr call, contains the following optional fields:
 *  - failureCodes: List of recoverable failure codes.
 *  - method: The HTTP method to use; default is 'GET'.
 *  - noCache: Disable request cache.
 *  - parameters: Set of parameters to pass to the xhr request.
 *  - successCodes: Only treat the request as successful if the return code is in this list.
 */
interface XhrOptions {
  failureCodes?: number[];
  method?: string;
  noCache?: boolean;
  parameters?: string | FormData;
  successCodes?: [number];
}

/**
 * XHR response for XSSI attacks after the magic prefix.
 */
interface XssiResponse {
  basepath: string;
  token: string;
}

/**
 * Handles different API calls to the backend notebooks server and Jupyter instance.
 */
class ApiManager {

  /**
   * URL for querying files
   */
  public static readonly contentApiUrl = '/api/contents';

  /**
   * URL for querying sessions
   */
  public static readonly sessionsApiUrl = '/api/sessions';

  /**
   * URL for starting terminals
   */
  public static readonly terminalApiUrl = '/api/terminals';

  /**
   * URL for retrieving the base path
   */
  public static readonly basepathApiUrl = '/api/basepath';

  /**
   * URL for user settings
   */
  public static readonly userSettingsUrl = '/_settings';

  /**
   * URL for app settings
   */
  public static readonly appSettingsUrl = '/api/settings';

  /**
   * URL for timeout info
   */
  public static readonly timeoutUrl = '/_timeout';

  /**
   * Current connection status. Set to the last connection status.
   */
  public static isConnected = true;

  /**
   * Handlers for connected/disconnected status. These will be called when the
   * isConnected property changes value.
   */
  public static connectedHandler: () => void;
  public static disconnectedHandler: () => void;

  /**
   * A promise to return a basepath.
   */
  private static _basepathPromise: Promise<string>;

  /**
   * XSRF token, if required, undefined until we call basepathApiUrl
   */
  private static _xsrfToken = '';

  /**
   * Returns a list of currently running sessions, each implementing the Session interface
   */
  public static listSessionsAsync(): Promise<Session[]> {
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    return ApiManager.sendRequestAsync(this.sessionsApiUrl, xhrOptions) as Promise<Session[]>;
  }

  /**
   * Terminates a running session.
   */
  public static shutdownSessionAsync(sessionId: string) {
    const xhrOptions: XhrOptions = {
      method: 'DELETE',
      successCodes: [204],
    };
    return ApiManager.sendRequestAsync(ApiManager.sessionsApiUrl + '/' + sessionId, xhrOptions);
  }

  /**
   * Returns a JupyterFile object representing the file or directory requested
   * @param path string path to requested file
   * @param asText whether the file should be downloaded as plain text. This is
   *               useful for downloading notebooks, which are by default read
   *               as JSON, which doesn't preserve formatting.
   */
  public static getJupyterFile(path: string, asText?: boolean): Promise<JupyterFile> {
    if (path.startsWith('/')) {
      path = path.substr(1);
    }
    if (asText === true) {
      path += '?format=text&type=file';
    }
    const xhrOptions: XhrOptions = {
      noCache: true,
    };
    return ApiManager.sendRequestAsync(this.contentApiUrl + '/' + path,
                                       xhrOptions) as Promise<JupyterFile>;
  }

  /**
   * Uploads the given file object to the backend. The file's name, path, format,
   * and content are required fields.
   * @param model object containing file information to send to backend
   */
  public static saveJupyterFile(model: JupyterFile) {
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PUT',
      parameters: JSON.stringify(model),
      successCodes: [200, 201],
    };
    const requestPath = ApiManager.contentApiUrl + '/' + model.path + '/' + model.name;
    return ApiManager.sendRequestAsync(requestPath, xhrOptions);
  }

  /**
   * Returns a list of files at the target path, each implementing the ApiFile interface.
   * Two requests are made to /api/contents and /api/sessions to get this data.
   * @param path current path to list files under
   */
  public static listFilesAsync(path: string): Promise<ApiFile[]> {

    const filesPromise = ApiManager.getJupyterFile(path)
      .then((file: JupyterFile) => {
        if (file.type !== 'directory') {
          throw new Error('Can only list files in a directory. Found type: ' + file.type);
        }
        return file.content as JupyterFile[];
      });

    const sessionsPromise: Promise<Session[]> = ApiManager.listSessionsAsync();

    // Combine the return values of the two requests to supplement the files
    // array with the status value.
    return Promise.all([filesPromise, sessionsPromise])
      .then((values) => {
        const files = values[0];
        const sessions = values[1];
        const runningPaths: string[] = [];
        sessions.forEach((session: Session) => {
          runningPaths.push(session.notebook.path);
        });
        files.forEach((file: ApiFile) => {
          file.status = runningPaths.indexOf(file.path) > -1 ? 'running' : '';
        });
        return files as ApiFile[];
      });
  }

  /**
   * Creates a new notebook or directory.
   * @param itemType string type of the created item, can be 'notebook' or 'directory'
   */
  public static createNewItem(itemType: string, path?: string) {
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        ext: 'ipynb',
        type: itemType,
      }),
      successCodes: [201],
    };
    let createPromise = ApiManager.sendRequestAsync(ApiManager.contentApiUrl, xhrOptions);

    // If a path is provided for naming the new item, request the rename, and
    // delete it if failed.
    if (path) {
      let notebookPathPlaceholder = '';
      createPromise = createPromise
        .then((notebook: JupyterFile) => {
          notebookPathPlaceholder = notebook.path;
          return ApiManager.renameItem(notebookPathPlaceholder, path);
        })
        .catch((error: string) => {
          // If the rename fails, remove the temporary item
          ApiManager.deleteItem(notebookPathPlaceholder);
          throw error;
        });
    }
    return createPromise;
  }

  /**
   * Renames an item
   * @param oldPath source path of the existing item
   * @param newPath destination path of the renamed item
   */
  public static renameItem(oldPath: string, newPath: string) {
    oldPath = ApiManager.contentApiUrl + '/' + oldPath;
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'PATCH',
      parameters: JSON.stringify({
        path: newPath
      }),
    };

    return ApiManager.sendRequestAsync(oldPath, xhrOptions);
  }

  /**
   * Deletes an item
   * @param path item path to delete
   */
  public static deleteItem(path: string) {
    path = ApiManager.contentApiUrl + '/' + path;
    const xhrOptions: XhrOptions = {
      failureCodes: [400],
      method: 'DELETE',
      successCodes: [204],
    };

    return ApiManager.sendRequestAsync(path, xhrOptions);
  }

  /*
   * Copies an item from source to destination. Item name collisions at the destination
   * are handled by Jupyter.
   * @param itemPath path to copied item
   * @param destinationDirectory directory to copy the item into
   */
  public static copyItem(itemPath: string, destinationDirectory: string) {
    destinationDirectory = ApiManager.contentApiUrl + '/' + destinationDirectory;
    const xhrOptions: XhrOptions = {
      failureCodes: [409],
      method: 'POST',
      parameters: JSON.stringify({
        copy_from: itemPath
      }),
      successCodes: [201],
    };

    return ApiManager.sendRequestAsync(destinationDirectory, xhrOptions);
  }

  /**
   * Initializes a terminal session.
   */
  public static startTerminalAsync() {
    const xhrOptions: XhrOptions = {
      method: 'POST',
    };
    return ApiManager.sendRequestAsync(ApiManager.terminalApiUrl, xhrOptions);
  }

  /**
   * Returns a list of active terminal sessions.
   */
  public static listTerminalsAsync() {
    return ApiManager.sendRequestAsync(ApiManager.terminalApiUrl);
  }

  /**
   * Returns a Promise that resolves to the base path.
   */
  public static getBasePath() {
    if (!ApiManager._basepathPromise) {
      ApiManager._basepathPromise = ApiManager. _xhrTextAsync(ApiManager.basepathApiUrl)
        .then((response: string) => {
          // The server may add the xssiPrefix to the response to prevent.
          // it being parsed as if it were a javascript file.
          const xssiPrefix = ')]}\'\n';
          if (!response.startsWith(xssiPrefix)) {
            // If no xssi prefix is there, the response should be pure text.
            // This will be the case when the basepath is on localhost.
            return response.replace(/\/$/, '');
          } else {
            // We did get a response with an xssi prefix, the rest of the
            // response will be JSON, which we can parse after removing the
            // prefix.
            response = response.substr(xssiPrefix.length);
            const j = JSON.parse(response) as XssiResponse;
            if (j.basepath) {
              // The response includes a basepath.
              // Check to ensure that the basepath doesn't have a trailing slash.
              return j.basepath.replace(/\/$/, '');
            } else {
              // The response didn't include the basepath, it should have
              // and xsrf token for us to use to retry our request as a POST.
              ApiManager._xsrfToken = j.token;
              const formData = new FormData();
              // The server expects the xsrfToken as FormData.
              formData.append('token', ApiManager._xsrfToken);
              const xhrOptions: XhrOptions = {
                method: 'POST',
                noCache: true,
                parameters: formData,
              };
              return ApiManager. _xhrTextAsync(ApiManager.basepathApiUrl, xhrOptions)
                .then((basePathResponse: string) => {
                  if (!basePathResponse.startsWith(xssiPrefix)) {
                    // The server didn't give us a basepath, even after we sent
                    // it the token. We give up.
                    throw new Error('unknown basepath prefix');
                  } else {
                    // We sent the token, so we should have a basepath.
                    // Make sure it doesn't have a trailing slash.
                    basePathResponse = basePathResponse.substr(xssiPrefix.length);
                    const basepath = (JSON.parse(basePathResponse) as XssiResponse).basepath;
                    return basepath.replace(/\/$/, '');
                  }
                });
            }
          }
        });
    }
    return ApiManager._basepathPromise;
  }

  /**
   * Sends an XMLHttpRequest to the specified URL, adding the required
   * base path, and expecting a JSON response. This method returns immediately
   * with a promise that resolves with the parsed object when the request completes.
   */
  public static sendRequestAsync(url: string, options?: XhrOptions) {
    return ApiManager.getBasePath()
      .then((base: string) => ApiManager. _xhrJsonAsync(base + url, options));
  }

  /**
   * Sends an XMLHttpRequest to the specified URL, adding the required
   * base path, and expecting a text response. This method returns immediately
   * with a promise that resolves with the returned text when the request completes.
   */
  public static sendTextRequestAsync(url: string, options?: XhrOptions): Promise<string> {
    return ApiManager.getBasePath()
      .then((base: string) => ApiManager. _xhrTextAsync(base + url, options));
  }

  /**
   * Sends an XMLHttpRequest to the specified URL, and parses the
   * the response text as json. This method returns immediately with a promise
   * that resolves with the parsed object when the request completes.
   */
  private static _xhrJsonAsync(url: string, options?: XhrOptions) {
    return ApiManager. _xhrTextAsync(url, options)
      .then((response: string) => JSON.parse(response || 'null'));
  }

  /**
   * Sends an XMLHttpRequest to the specified URL, and returns the
   * the response text. This method returns immediately with a promise
   * that resolves with the response text when the request completes.
   */
  private static _xhrTextAsync(url: string, options?: XhrOptions): Promise<string> {

    options = options || {};
    const method = options.method || 'GET';
    const params = options.parameters;
    const successCodes = options.successCodes || [200];
    const request = new XMLHttpRequest();
    const noCache = options.noCache || false;
    const failureCodes = options.failureCodes;

    return new Promise((resolve, reject) => {
      request.onreadystatechange = () => {
        if (request.readyState === 4) {
          if (successCodes.indexOf(request.status) > -1) {

            // If this is the first success after failures, call the connected handler
            if (!ApiManager.isConnected && ApiManager.connectedHandler) {
              ApiManager.connectedHandler();
            }
            ApiManager.isConnected = true;

            try {
              resolve(request.responseText);
            } catch (e) {
              reject(e);
            }
          } else {

            // If this is an unexpected failure, call the disconnected handler
            if (!failureCodes || failureCodes.indexOf(request.readyState) > -1) {
              if (ApiManager.isConnected && ApiManager.disconnectedHandler) {
                ApiManager.disconnectedHandler();
              }
              ApiManager.isConnected = false;
            }

            // Jupyter returns error messages with schema {"reason": string, "message": string}
            // TODO: Should not need this when relying on a different content service.
            let errorMessage = request.responseText;
            try {
              errorMessage = JSON.parse(request.responseText).message || errorMessage;
            } catch (_) {
              // This is fine, if the error isn't a JSON, return it as is.
            }
            reject(new Error(errorMessage));
          }
        }
      };

      request.open(method, url);
      if (noCache) {
        request.setRequestHeader('Cache-Control', 'no-cache');
      }
      request.send(params);
    });
  }

}
