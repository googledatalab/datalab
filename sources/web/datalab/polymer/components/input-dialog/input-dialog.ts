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

class InputDialogElement extends Polymer.Element {

  public title: string;
  public bodyHtml: string;
  public withInput: boolean;
  public inputLabel: string;
  public inputValue: string;
  public okTitle: string;
  public cancelTitle: string;

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
      okTitle: {
        type: String,
        value: 'Ok',
      },
      cancelTitle: {
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

    if (this.bodyHtml) {
      this.$.body.innerHTML = this.bodyHtml;
    }
    if (this.withInput && this.inputValue) {
      this.$.theDialog.addEventListener('iron-overlay-opened', function() {
        const inputElement = self.$.inputBox.$.nativeInput;
        inputElement.focus();
        inputElement.selectionStart = 0;
        inputElement.selectionEnd = self.inputValue.lastIndexOf('.');
      });
    }
    this.$.theDialog.addEventListener('iron-overlay-closed', function() {
      self._cancelClose();
    });
    this.$.theDialog.open();
  }

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

  _checkEnter(e: KeyboardEvent) {
    if (e.keyCode === 13) // Enter
      this._confirmClose();
  }

}

customElements.define(InputDialogElement.is, InputDialogElement);
