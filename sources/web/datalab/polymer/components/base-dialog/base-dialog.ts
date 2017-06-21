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
 * Dialog close context, includes whether the dialog was confirmed.
 */
interface BaseDialogCloseResult {
  confirmed: boolean,
}

/**
 * Base Dialog element for Datalab. This element can be extended to insert custom markup
 * (including other custom elements) inside it. This can be best done by stamping the
 * subclass's element template into the #body element of this class.
 */
class BaseDialogElement extends Polymer.Element {

  /**
   * Title string of the dialog, shows up as <h2>
   */
  public title: string;

  /**
   * Message to show in dialog
   */
  public messageHtml: string;

  /**
   * Whether to show a big dialog
   */
  public big: boolean;

  /**
   * String for confirm button
   */
  public okLabel: string;

  /**
   * String for cancel button
   */
  public cancelLabel: string;

  private _closeCallback: (result: BaseDialogCloseResult) => void;

  static get is() { return "base-dialog"; }

  static get properties() {
    return {
      title: {
        type: String,
        value: '',
      },
      messageHtml: {
        type: String,
        value: '',
      },
      big: {
        type: Boolean,
        value: false,
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

    // Set the message's inner HTML
    if (this.messageHtml) {
      this.$.message.innerHTML = this.messageHtml;
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
  openAndWaitAsync(callback: (_: BaseDialogCloseResult) => void) {
    if (callback) {
      this._closeCallback = callback;
    }
    this.open();
  }

  /**
   * Returns any extra data to be augmented with the closing context object. Classes
   * extending this element can override this method to pass back extra information.
   */
  getCloseResult() {
    return {};
  }

  _confirmClose() {
    this._dialogClosed(true);
  }

  _cancelClose() {
    this._dialogClosed(false);
  }

  _dialogClosed(confirmed: boolean) {
    if (this._closeCallback) {
      this._closeCallback(Object.assign({
        confirmed: confirmed,
      }, this.getCloseResult()));
    }
    this.$.theDialog.close();
  }

  /**
   * Helper method to listen for Enter key when an input is present
   */
  _checkEnter(e: KeyboardEvent) {
    if (e.keyCode === 13) // Enter
      this._confirmClose();
  }

}

customElements.define(BaseDialogElement.is, BaseDialogElement);
