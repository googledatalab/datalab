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

  interface Settings {

    consoleLogging: boolean;
    logFilePath: string;
    logFilePeriod: string;
    logFileCount: number;

    /**
     * Name of this datalab instance.
     * It is also used as part of the name of the cloud source repository
     * branch that stores all notebooks created from this datalab instance.
     */
    instanceName: string;

    /**
     * User ID of the email when running locally.
     */
    instanceUser: string;

    /**
     * Id of the cloud project that the datalab instance runs in.
     */
    projectId: string;
    projectNumber: string;

    release: string;
    versionId: string;
    instanceId: string;
    analyticsId: string;
    configUrl: string;
    feedbackId: string;
    logEndpoint: string;

    /**
     * The port that the server should listen to.
     */
    serverPort: number;

    /**
     * The list of static arguments to be used when launching jupyter.
     */
    jupyterArgs: string[];

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
     * Whether authentication is enabled.
     */
    enableAuth: boolean;
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
