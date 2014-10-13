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


/**
 * Interfaces definitions
 */
declare module app {

  interface Settings {
    httpPort: number;
  }

  interface Map<T> {
    [index: string]: T;
  }

  interface KernelConfig {
    iopubPort: number;
    shellPort: number;
  }

  interface KernelMessageHandler {
    (message: any): void;
  }

  interface IKernel {
    id: string;
    config: KernelConfig;
    start (): void;
    shutdown (): void;
    onMessage (handler: KernelMessageHandler): void;
    execute (request: ExecuteRequest): void;
  }

  interface IKernelManager {
    create (config: KernelConfig): IKernel;
    get (id: string): IKernel;
    list (): IKernel[];
    shutdown (id: string): void;
    shutdownAll (): void;
  }

}
