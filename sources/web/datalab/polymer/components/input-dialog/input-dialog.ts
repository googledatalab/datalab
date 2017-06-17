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
 * Input Dialog element for Datalab.
 * This element is a modal dialog that is configurable to popup a message to the
 * user, or let them input some value, with confirm and cancel buttons. The input
 * can optionally start up with a value that is selected. Currently, the modal
 * treats this value as a file name with an extension, and it selects all characters
 * up to the last '.' to make it easy to edit file names.
 * 
 * TODO: [yebrahim] Consider exporting this behavior to the host element to allow
 * for more general use cases.
 */
class InputDialogElement extends Polymer.Element {

  /**
   * Title string of the dialog, shows up as <h2>
   */
  public title: string;

  /**
   * HTML for message in the dialog, will be inserted as innerHTML
   */
  public bodyHtml: string;

  /**
   * Whether an input field should be included in this dialog
   */
  public withInput: boolean;

  /**
   * Text that shows up inside the input field when it's empty
   */
  public inputLabel: string;

  /**
   * If an input field is included, this will be its initial value
   */
  public inputValue: string;

  /**
   * String for confirm button
   */
  public okLabel: string;

  /**
   * String for cancel button
   */
  public cancelLabel: string;

  private _closeCallback: Function;

  static get is() { return "input-dialog"; }

  static get properties() {
    return {
      title: {
        type: String,
        value: '',
      },
      bodyHtml: {
        type: String,
        value: '',
      },
      withInput: {
        type: Boolean,
        value: false,
      },
      inputLabel: {
        type: String,
        value: '',
      },
      inputValue: {
        type: String,
        value: '',
      },
      okLabel: {
        type: String,
        value: 'Ok',
      },
      cancelLabel: {
        type: String,
        value: 'Cancel'
      },
    }
  }

  open() {
    const self = this;

    // Set the focus to the input field if it's visible,
    // otherwise to the ok button.
    if (this.withInput) {
      this.$.inputBox.setAttribute('autofocus', '');
    } else {
      this.$.okButton.setAttribute('autofocus', '');
    }

    // Set the body's inner HTML
    if (this.bodyHtml) {
      this.$.body.innerHTML = this.bodyHtml;
    }

    // If an input is included, wait for the dialog to open, then select its text
    if (this.withInput && this.inputValue) {
      this.$.theDialog.addEventListener('iron-overlay-opened', function() {
        const inputElement = self.$.inputBox.$.nativeInput;
        inputElement.focus();
        inputElement.selectionStart = 0;
        inputElement.selectionEnd = self.inputValue.lastIndexOf('.');
      });
    }

    // If the closed event fires then the confirm button hasn't been clicked
    this.$.theDialog.addEventListener('iron-overlay-closed', function() {
      self._cancelClose();
    });
    this.$.theDialog.open();
  }

  /**
   * Opens the dialog and takes a callback function that will be called when
   * the dialog is closed with the close options.
   */
  openAndWaitAsync(callback: Function) {
    if (callback) {
      this._closeCallback = callback;
    }
    this.open();
  }

  _confirmClose() {
    this._dialogClosed(true);
  }

  _cancelClose() {
    this._dialogClosed(false);
  }

  _dialogClosed(confirmed: boolean) {
    if (this.$.theDialog.opened && this._closeCallback) {
      this._closeCallback({
        confirmed: confirmed,
        userInput: this.withInput ? this.$.inputBox.value : undefined,
      });
    }
  }

  /**
   * Helper method to listen for Enter key when an input is present
   */
  _checkEnter(e: KeyboardEvent) {
    if (e.keyCode === 13) // Enter
      this._confirmClose();
  }

}

customElements.define(InputDialogElement.is, InputDialogElement);
