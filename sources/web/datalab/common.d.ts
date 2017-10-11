/*
 * Copyright 2015 Google Inc. All rights reserved.
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

declare module common {

  interface UserSettings {
    startuppath: string,
    theme: string,
    idleTimeoutShutdownCommand: string,
    idleTimeoutInterval: string,
    oauth2ClientId: string,
    [index: string]: string,
  }

  interface AppSettings {

    /**
     * Whether or not to write log statements to stderr
     */
    consoleLogging: boolean;

    /**
     * The minimum threshold for log statements to be written to stderr.
     * Values should be one of 'trace', 'debug', 'info',
     * 'warn', 'error', or 'fatal'.
     */
    consoleLogLevel: string;

    /**
     * The default file manager type to use if none is specified.
     */
    defaultFileManager: string;

    logFilePath: string;
    logFilePeriod: string;
    logFileCount: number;

    release: string;
    versionId: string;
    instanceId: string;
    configUrl: string;
    knownTutorialsUrl: string;
    feedbackId: string;
    logEndpoint: string;

    /**
     * Where to update docs, samples.
     */
    docsGcsPath: string;

    /**
     * The port that the server should listen to.
     */
    serverPort: number;

    /**
     * The list of static arguments to be used when launching jupyter.
     */
    jupyterArgs: string[];

    /**
     * If provided, use this as a prefix to all file paths opened on the
     * server side. Useful for testing outside a Docker container.
     */
    datalabRoot: string;

    /**
     * If provided, use this as a prefix to all URL paths. This is useful
     * for running a Datalab instance behind a shared proxy with other
     * servers (including, for running multiple Datalab instances together).
     *
     * The specified value does not need to include leading or trailing
     * slashes. Those will automatically be added if ommitted.
     */
    datalabBasePath: string;

    /**
     * If true, use proxy-able web sockets.
     */
    proxyWebSockets: string;

    /**
     * Initial port to use when searching for a free Jupyter port.
     */
    nextJupyterPort: number;

    /**
     * The port to use for socketio proxying.
     */
    socketioPort: number;

    /**
     * Local directory which stores notebooks in the container
     */
    contentDir: string;

    /**
     * Whether to use the git and workspace functionality.
     */
    useWorkspace: boolean;

    /**
     * Whether to support querystring based user overriding.
     * Useful when debugging multi-user functionality locally.
     */
    supportUserOverride: boolean;

    /**
     * Metadata host name. If specified, will override the default
     * metadata host in AppEngine VM, mostly for local run so that
     * the service account access token will be available locally.
     */
    metadataHost: string;

    /**
     * The value for the access-control-allow-origin header. This
     * allows another frontend to connect to Datalab.
     */
    allowOriginOverrides: Array<string>;

    /**
     * If true, allow HTTP requests via websockets.
     */
    allowHttpOverWebsocket: boolean;

    /**
     * Whether to automatically back up user's contents dir to GCS
     */
    enableAutoGCSBackups: boolean;

    /**
     * Whether to index the file system for finding files
     */
    enableFilesystemIndex: boolean;

    /**
     * Number of hourly GCS backups of the user's content dir to keep
     */
    numHourlyBackups: number;

    /**
     * Number of daily GCS backups of the user's content dir to keep
     */
    numDailyBackups: number;

    /**
     * Number of weekly GCS backups of the user's content dir to keep
     */
    numWeeklyBackups: number;

    /**
     * The idle timeout interval, such as "2h 30m".
     */
    idleTimeoutInterval: string;

    /**
     * The shutdown command to use after an idle timeout.
     */
    idleTimeoutShutdownCommand: string;

    /**
     * List of supported sources for the file browser.
     * Possible options are: jupyter, drive, sharedDrive, docs, and bigquery
     */
    supportedFileBrowserSources: string[];

    /**
     * The host/port on which to serve the fake metadata service, if active.
     */
    fakeMetadataAddress: {host: "metadata.google.internal"|"metadata"|null, port: number};

    /**
     * List of features that can be optinally enabled.
     */
    gatedFeatures: string[];
  }

  interface TimeoutInfo {
    enabled: boolean;
    expirationTime: number;
    secondsRemaining: number;
    idleTimeoutSeconds: number;
  }

  interface Map<T> {
    [index: string]: T;
  }

  interface Callback<T> {
    (e: Error, result: T): void;
  }

  interface Callback0 {
    (e: Error): void;
  }
}

interface Window {
  datalab: { [key: string]: string }
}
