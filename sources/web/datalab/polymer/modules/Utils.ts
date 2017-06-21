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
 * Options for opening a dialog.
 */
enum DialogType {
  input,
  confirm,
}
interface DialogOptions {
  title: string,
  messageHtml?: string,
  bodyHtml?: string,
  inputLabel?: string,
  inputValue?: string,
  okLabel?: string,
  cancelLabel?: string,
  big?: boolean,
}

/**
 * Class provides helper methods for various operations.
 */
class Utils {

  /**
   * Opens a dialog with the specified options. It uses the Datalab custom element
   * according to the specified dialog type, attaches a new instance to the current
   * document, opens it, and returns a promise that resolves when the dialog is closed.
   * @param type specifies which type of dialog to use
   * @param dialogOptions specifies different options for opening the dialog
   */
  static showDialog(type: DialogType, dialogOptions: DialogOptions) {
    let dialogElement = '';
    if (type === DialogType.input) {
      dialogElement = 'input-dialog';
    } else if (type === DialogType.confirm) {
      dialogElement = 'base-dialog';
    }
    const dialog = <any>document.createElement(dialogElement);
    document.body.appendChild(dialog);

    if (dialogOptions.title)
      dialog.title = dialogOptions.title;
    if (dialogOptions.messageHtml)
      dialog.messageHtml = dialogOptions.messageHtml;
    if (dialogOptions.inputLabel)
      dialog.inputLabel = dialogOptions.inputLabel;
    if (dialogOptions.inputValue)
      dialog.inputValue = dialogOptions.inputValue;
    if (dialogOptions.okLabel)
      dialog.okLabel = dialogOptions.okLabel;
    if (dialogOptions.cancelLabel)
      dialog.cancelLabel = dialogOptions.cancelLabel;
    if (dialogOptions.big !== undefined)
      dialog.big = dialogOptions.big;

    // Open the dialog
    return new Promise(resolve => {
      dialog.openAndWaitAsync((closeResult: InputDialogCloseResult) => {
        document.body.removeChild(dialog);
        resolve(closeResult);
      });
    });
  }
 
}
