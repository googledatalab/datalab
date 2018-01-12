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
  confirmed: boolean;
}

/**
 * Options for opening a base dialog.
 */
interface BaseDialogOptions extends Object {
  big?: boolean;
  cancelLabel?: string;
  isError?: boolean;
  message?: string;
  okLabel?: string;
  title: string;
}

/**
 * Base Dialog element for Datalab. This element can be extended to insert custom markup
 * (including other custom elements) inside it. This can be best done by stamping the
 * subclass's element template into the #body element of this class.
 */
@Polymer.decorators.customElement('base-dialog')
class BaseDialogElement extends Polymer.Element {

  /**
   * Title string of the dialog, shows up as <h2>
   */
  @Polymer.decorators.property({type: String})
  public title = '';

  /**
   * Message to show in dialog
   */
  @Polymer.decorators.property({type: String})
  public message = '';

  /**
   * Whether to show a big dialog
   */
  @Polymer.decorators.property({type: Boolean})
  public big = false;

  /**
   * String for confirm button
   */
  @Polymer.decorators.property({type: String})
  public okLabel = 'Ok';

  /**
   * String for cancel button
   */
  @Polymer.decorators.property({type: String})
  public cancelLabel = 'Cancel';

  /**
   * Whether this is an error dialog (affects styling)
   */
  @Polymer.decorators.property({type: Boolean})
  public isError = false;

  @Polymer.decorators.property({computed: '_computeSizeCssClass(big)', type: String})
  _sizeCssClass: string;

  private _closeCallback: (result: BaseDialogCloseResult) => void;

  static get is() { return 'base-dialog'; }

  open() {
    // If the closed event fires then the confirm button hasn't been clicked
    this.$.theDialog.addEventListener('iron-overlay-closed', () => this._cancelClose());
    this.$.theDialog.open();
  }

  openAndWait(): Promise<BaseDialogCloseResult> {
    return new Promise<BaseDialogCloseResult>((resolve, _reject) => {
      this.openAndWaitAsync(resolve);
    });
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

  _computeSizeCssClass(big: boolean) {
    return big ? 'big' : 'small';
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
        confirmed,
      }, this.getCloseResult()));
    }
    this.$.theDialog.close();
  }

  /**
   * Helper method to listen for Enter key when an input is present
   */
  _checkEnter(e: KeyboardEvent) {
    if (e.keyCode === 13) { // Enter
      this._confirmClose();
    }
  }

}
