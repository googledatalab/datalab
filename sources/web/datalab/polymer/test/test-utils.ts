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

/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />

declare function assert(condition: boolean, message: string): null;
declare function fixture(element: string): any;

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
   * Dismisses the given dialog element by clicking its cancel button.
   * Returns a promise that resolves after the dialog is dismissed.
   */
  public static cancelDialog(dialog: BaseDialogElement) {
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
    dialog.$.cancelButton.click();
    return p;
  }
}
