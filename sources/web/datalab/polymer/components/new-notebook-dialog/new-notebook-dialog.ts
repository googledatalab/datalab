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
 * Dialog close context, includes whether the dialog was confirmed, any
 * user input given, and the kernel selected by the user.
 */
interface NewNotebookDialogCloseResult extends BaseDialogCloseResult {
  userInput: string;
  kernel: string;
}

interface NewNotebookDialogOptions extends BaseDialogOptions {
  inputLabel?: string;
  inputValue?: string;
  selectedKernel?: string;
}

/**
 * New Notebook Dialog element for Datalab, extends the Input dialog element.
 * This element is a modal dialog that presents the user with an input box, and
 * a dropdown list with possible kernel values. The input can optionally start
 * up with a value that is selected. The default kernel will be selected.
 */
class NewNotebookDialogElement extends BaseDialogElement {

  protected static _memoizedTemplate: PolymerTemplate;

  /**
   * Text that shows up inside the input field when it's empty
   */
  public inputLabel: string;

  /**
   * If an input field is included, this will be its initial value
   */
  public inputValue: string;

  /**
   * The kernel that should be selected by default.
   */
  public selectedKernel: string;

  protected _kernelSpecs: KernelSpec[];

  static get is() { return 'new-notebook-dialog'; }

  static get properties() {
    return Object.assign(super.properties, {
      _kernelSpecs: {
        type: Array,
        value: [],
      },
      inputLabel: {
        type: String,
        value: '',
      },
      inputValue: {
        type: String,
        value: '',
      },
      selectedKernel: {
        type: String,
        value: '',
      },
    });
  }

  open() {
    this._kernelSpecs = KernelManager.getAllKernelSpecs();
    // Prevent propagation of the iron-overlay-closed event fired by the
    // dropdown. Otherwise, it'll cause the dialog to close.
    this.$.kernelDropdown.addEventListener('iron-overlay-closed', (e: Event) => {
      e.stopPropagation();
    });
    super.open();
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
   * Also send back the user selected kernel in the closing context.
   */
  getCloseResult() {
    return Object.assign(super.getCloseResult(), {
      kernel: this.$.dropdownItems.selectedItem.value,
      userInput: this.$.inputBox.value,
    });
  }

}

customElements.define(NewNotebookDialogElement.is, NewNotebookDialogElement);
