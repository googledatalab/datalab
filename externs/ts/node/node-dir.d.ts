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

declare module NodeDir {
  interface Paths {
    files: string[];
    dirs: string[];
  }

  interface PathsCallback {
    (error: Error, paths: Paths): void;
  }

  interface Module {
    paths(dir: string, callback: PathsCallback): void;
  }
}

declare module "node-dir" {
    var nodedir: NodeDir.Module;
    export = nodedir;
}
