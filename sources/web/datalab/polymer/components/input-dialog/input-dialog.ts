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
 * Dialog close context, includes whether the dialog was confirmed, and any
 * user input given.
 */
interface InputDialogCloseResult extends BaseDialogCloseResult {
  userInput: string;
}

/**
 * Options for opening an input dialog.
 */
interface InputDialogOptions extends BaseDialogOptions {
  bodyHtml?: string;
  inputLabel?: string;
  inputValue?: string;
}

/**
 * Input Dialog element for Datalab, extends the Base dialog element.
 * This element is a modal dialog that presents the user with an input box. The input
 * can optionally start up with a value that is selected. Currently, the modal
 * treats this value as a file name with an extension, and it selects all characters
 * up to the last '.' to make it easy to edit file names.
 */
class InputDialogElement extends BaseDialogElement {

  private static _memoizedTemplate: PolymerTemplate;

  /**
   * HTML for message in the dialog, will be inserted as innerHTML
   */
  public bodyHtml: string;

  /**
   * Text that shows up inside the input field when it's empty
   */
  public inputLabel: string;

  /**
   * If an input field is included, this will be its initial value
   */
  public inputValue: string;

  static get is() { return 'input-dialog'; }

  static get properties() {
    return Object.assign(super.properties, {
      bodyHtml: {
        type: String,
        value: '',
      },
      inputLabel: {
        type: String,
        value: '',
      },
      inputValue: {
        type: String,
        value: '',
      },
    });
  }

  open() {
    super.open();

    // If an input is included, wait for the dialog to open, then select its text
    if (this.inputValue) {
      this.$.theDialog.addEventListener('iron-overlay-opened', () => {
        const inputElement = this.$.inputBox.$.nativeInput;
        inputElement.focus();
        inputElement.selectionStart = 0;
        inputElement.selectionEnd = this.inputValue.lastIndexOf('.');
      });
    }
  }

  /**
   * This template is calculated once in run time based on the template of  the
   * super class, then saved in a local variable for memoization.
   * See https://www.polymer-project.org/2.0/docs/devguide/dom-template#inherited-templates
   */
  static get template() {
    if (!this._memoizedTemplate) {
      this._memoizedTemplate = Utils.stampInBaseTemplate(this.is, super.is, '#body');
    }
    return this._memoizedTemplate;
  }

  /**
   * Also send back the user input value in the closing context.
   */
  getCloseResult() {
    return {
      userInput: this.$.inputBox.value,
    };
  }

}

customElements.define(InputDialogElement.is, InputDialogElement);
