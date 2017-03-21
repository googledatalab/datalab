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
 * Type definitions for the chokidar node module
 */

declare module "chokidar" {
  export class FSWatcher {
    constructor(options?: WatchOptions);
    add(fileDirOrGlob:string):void;
    add(filesDirsOrGlobs:Array<string>):void;
    unwatch(fileDirOrGlob:string):void;
    unwatch(filesDirsOrGlobs:Array<string>):void;
    getWatched():any;
    on(event: 'add', fn: (path: string, stats?: fs.Stats) => void): this;
    on(event: 'change', fn: (path: string, stats?: fs.Stats) => void): this;
    on(event: 'unlink', fn: (path: string) => void): this;
    on(event: 'raw', fn: (event: string, path:string, details:any) => void): this;
    on(event: 'all', fn: (event: string, path: string) => void): this;
    on(event: string, fn: (path: string) => void): this;
    close(): this;
  }

  interface WatchOptions {
    persistent?:boolean;
    ignored?:any;
    ignoreInitial?:boolean;
    followSymlinks?:boolean;
    cwd?:string;
    usePolling?:boolean;
    useFsEvents?:boolean;
    alwaysStat?:boolean;
    depth?:number;
    interval?:number;
    binaryInterval?:number;
    ignorePermissionErrors?:boolean;
    atomic?:boolean;
    awaitWriteFinish?:any;
  }

  import fs = require("fs");

  export function watch(fileDirOrGlob:string, options?:WatchOptions):FSWatcher;
  export function watch(filesDirsOrGlobs:Array<string>, options?:WatchOptions):FSWatcher;
}
