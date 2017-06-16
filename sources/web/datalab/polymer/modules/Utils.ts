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

interface DialogOptions {
  title: string,
  bodyHtml?: string,
  withInput?: boolean,
  inputLabel?: string,
  inputValue?: string,
  okTitle?: string,
  cancelTitle?: string,
}

interface DialogCloseResult {
  confirmed: boolean
  userInput: string,
}

class Utils {

  static getUserInputAsync(dialogOptions: DialogOptions) {
    let createModal = <InputDialogElement>document.createElement('input-dialog');
    document.body.appendChild(createModal);

    createModal.title = dialogOptions.title;
    if (dialogOptions.bodyHtml)
      createModal.bodyHtml = dialogOptions.bodyHtml;
    if (dialogOptions.withInput !== undefined)
      createModal.withInput = dialogOptions.withInput;
    if (dialogOptions.inputLabel)
      createModal.inputLabel = dialogOptions.inputLabel;
    if (dialogOptions.inputValue)
      createModal.inputValue = dialogOptions.inputValue;
    if (dialogOptions.okTitle)
      createModal.okTitle = dialogOptions.okTitle;
    if (dialogOptions.cancelTitle)
      createModal.cancelTitle = dialogOptions.cancelTitle;

    // Open the dialog
    return new Promise(resolve => {
      createModal.openAndWaitAsync((closeResult: DialogCloseResult) => {
        document.body.removeChild(createModal);
        resolve(closeResult);
      });
    });
  }
 
}
