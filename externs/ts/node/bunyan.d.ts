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


/**
 * Type definitions for bunyan node module v 1.2.0
 */

/// <reference path="node.d.ts" />

declare module 'bunyan' {

  export interface Map<T> {
    [index: string]: T;
  }

  export interface ILogger {
    child(childInfo: Map<string>): ILogger;

    debug(message: string): void;
    debug(format: string, ...objects: Object []): void;
    debug(data: Map<any>): void;
    debug(data: Map<any>, message: string): void;
    debug(data: Map<any>, format: string, ...objects: Object []): void;
    debug(error: Error, message: string): void;
    debug(error: Error, format: string, ...objects: Object []): void;

    error(message: string): void;
    error(format: string, ...objects: Object []): void;
    error(data: Map<any>): void;
    error(data: Map<any>, message: string): void;
    error(data: Map<any>, format: string, ...objects: Object []): void;
    error(error: Error, message: string): void;
    error(error: Error, format: string, ...objects: Object []): void;

    fatal(message: string): void;
    fatal(format: string, ...objects: Object []): void;
    fatal(data: Map<any>): void;
    fatal(data: Map<any>, message: string): void;
    fatal(data: Map<any>, format: string, ...objects: Object []): void;
    fatal(error: Error, message: string): void;
    fatal(error: Error, format: string, ...objects: Object []): void;

    info(message: string): void;
    info(format: string, ...objects: Object []): void;
    info(data: Map<any>): void;
    info(data: Map<any>, message: string): void;
    info(data: Map<any>, format: string, ...objects: Object []): void;
    info(error: Error, message: string): void;
    info(error: Error, format: string, ...objects: Object []): void;

    trace(message: string): void;
    trace(format: string, ...objects: Object []): void;
    trace(data: Map<any>): void;
    trace(data: Map<any>, message: string): void;
    trace(data: Map<any>, format: string, ...objects: Object []): void;
    trace(error: Error, message: string): void;
    trace(error: Error, format: string, ...objects: Object []): void;

    warn(message: string): void;
    warn(format: string, ...objects: Object []): void;
    warn(data: Map<any>): void;
    warn(data: Map<any>, message: string): void;
    warn(data: Map<any>, format: string, ...objects: Object []): void;
    warn(error: Error, message: string): void;
    warn(error: Error, format: string, ...objects: Object []): void;
  }

  export interface LogSerializer {
    (obj: any): Map<String>;
  }

  export interface LogStream {
    type: string;
    level: string;
    stream?: NodeJS.WritableStream;
    path?: string;
    period?: string;
    count?: number;
  }

  export interface LoggerOptions {
    name: string;
    streams?: LogStream[];
    serializers?: Map<LogSerializer>;
  }

  export function createLogger(options: LoggerOptions): ILogger;
}
