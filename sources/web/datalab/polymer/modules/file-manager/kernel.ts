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

enum KernelType {
  PYTHON2 = 'python2',
  PYTHON3 = 'python3',
}

interface KernelSpec {
  display_name: string;
  language: string;
  name: string;
}

class KernelManager {

  private static _kernelSpecs = new Map<string, KernelSpec> ([
    [
      KernelType.PYTHON2, {
        display_name: 'Python 2',
        language: 'python',
        name: 'python2',
      }
    ],
    [
      KernelType.PYTHON3, {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      }
    ],
  ]);

  static getKernelSpec(kernel: string): KernelSpec {
    const spec = this._kernelSpecs.get(kernel);
    if (spec === undefined) {
      throw new Error('Incorrect kernel type: ' + kernel);
    }
    return spec;
  }

  static getAllKernelSpecs(): KernelSpec[] {
    return Array.from(this._kernelSpecs.values());
  }
}
