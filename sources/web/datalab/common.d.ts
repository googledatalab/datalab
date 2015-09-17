/*
 * Copyright 2014 Google Inc. All rights reserved.
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

    instanceUser: string;

    projectNumber: string;

    /**
     * Id of the cloud project that the datalab instance runs in.
     */
    projectId: string;

    /**
     * Name of this datalab instance in the cloud project.
     * It is also used as part of the name of the cloud source repository
     * branch that stores all notebooks created from this datalab instance.
     */
    instanceName: string;

    versionId: string;
    instanceId: string;
    analyticsId: string;
    feedbackId: string;

    serverPort: number;

    jupyterArgs: string[];

    /**
     * Where this instance is running. Can only be "cloud" or "local".
     */
    environment: string;
    
    /**
     * Local directory which stores notebooks in the container
     */
    contentDir: string;
  }

  interface Map<T> {
    [index: string]: T;
  }

  interface Callback<T> {
    (e: Error, result: T): void;
  }
}
