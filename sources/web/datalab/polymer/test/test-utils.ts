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

/* test-utils contains utility functions for use in tests.
 * If you are looking for the unit tests for polymer/modules/utils,
 * those are in utils-test.
 */

/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />
/// <reference path="../node_modules/@types/sinon/index.d.ts" />

declare function fixture(element: string): any;

class MockFile extends DatalabFile {
  constructor(name = '', path = '', type = DatalabFileType.DIRECTORY) {
    super(
      new DatalabFileId(path, FileManagerType.MOCK),
      name,
      type,
    );
  }
  getColumnValues() {
    return [this.name, this.type.toString()];
  }
}

class MockFileManager extends BaseFileManager {
  public getColumns() {
    return [{
        name: Utils.constants.columns.name,
        type: ColumnTypeName.STRING,
      }, {
        name: 'Type',
        type: ColumnTypeName.STRING,
      }];
  }
  public async getRootFile() {
    return new MockFile('root');
  }
  public async pathToFileHierarchy(path: string): Promise<DatalabFile[]> {
    return [new MockFile('', path)];
  }
}

class TestUtils {
  /**
   * Returns the currently open dialog object, and asserts that there is exactly
   * one dialog open.
   */
  public static getDialog(dialogType: typeof BaseDialogElement) {
    const dialogs = document.querySelectorAll(dialogType.is) as NodeListOf<BaseDialogElement>;
    assert(dialogs.length === 1, 'either no dialogs or more than one dialog open');
    return dialogs[0];
  }

  /**
   * Dismisses the given dialog element by clicking its ok or cancel button.
   * Returns a promise that resolves after the dialog is dismissed.
   */
  public static closeDialog(dialog: BaseDialogElement, confirm: boolean) {
    // Dismiss the dialog
    const p = new Promise((resolve, reject) => {
      dialog.addEventListener('iron-overlay-closed', () => {
        Polymer.dom.flush();
        if (document.querySelector('input-dialog') === null) {
          resolve();
        } else {
          reject();
        }
      });
    });
    if (confirm) {
      dialog.$.okButton.click();
    } else {
      dialog.$.cancelButton.click();
    }
    return p;
  }

  /**
   * Waits for the given condition to evaluate to true, with a given timeout in
   * milliseconds. It achieves this by polling on the condition function every
   * 10 milliseconds.
   * Returns a promise that always resolves, returning true or false to
   * indicate whether or not the condition was satisfied within the timeout.
   */
  public static waitUntilTrue(func: () => boolean, timeoutMs: number) {
    const start = Date.now();

    return new Promise((resolve) => {
      if (func()) {
        resolve(true);
      } else {
        const handle = window.setInterval(() => {
          if (func()) {
            window.clearInterval(handle);
            resolve(true);
          } else if (Date.now() > start + timeoutMs) {
            window.clearInterval(handle);
            resolve(false);
          }
        }, 10);
      }
    });
  }
}
