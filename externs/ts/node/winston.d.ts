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


declare module "winston" {
    function log(level: string, message: string, metadata?: any): void;
    function debug(message: string, metadata?: any): void;
    function info(message: string, metadata?: any): void;
    function warn(message: string, metadata?: any): void;
    function error(message: string, metadata?: any): void;

    function add(transport: Transport, options: any): void;
    function remove(transport: Transport): void;

    function profile(name: string): void;

    function query(options: any, done: (err: any, results: any) => void): void;

    function stream(options: any): any;

    function handleExceptions(transport: Transport): void;

    interface Transport {
    }
    interface Transports {
        File: Transport;
        Console: Transport;
        Loggly: Transport;
        DailyRotateFile: Transport;
    }
    export var transports: Transports;
    export var exitOnError: boolean;

    interface TransportConfig {
        level?: string;
        silent?: boolean;
        colorize?: boolean;
        timestamp?: boolean;
        prettyPrint?: boolean;
        depth?: number;
        showLevel?: boolean;
        formatter?: Function;
    }

    interface ConsoleConfig extends TransportConfig {
        debugStdout?: boolean;
    }

    interface DailyRotateFileConfig extends TransportConfig {
        datePattern?: string;
        filename?: string;
        maxFiles?: number;
    }
}
