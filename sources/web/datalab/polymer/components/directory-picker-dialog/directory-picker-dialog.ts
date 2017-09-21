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

/// <reference path="../file-browser/file-browser.ts" />

/**
 * Dialog close context, includes whether the dialog was confirmed, and the user selected
 * directory path.
 */
interface DirectoryPickerDialogCloseResult extends BaseDialogCloseResult {
  selectedDirectory: DatalabFile;
  fileName?: string;
}

/**
 * Options for opening a directory picker dialog.
 */
interface DirectoryPickerDialogOptions extends BaseDialogOptions {
  fileId?: string;    // The initial directory to use
  fileName?: string;
  withFileName: boolean;
}

/**
 * Directory Picker Dialog element for Datalab, extends the Base dialog element.
 * This element is a modal dialog that presents the user with a file picker that can navigate
 * into directories to select destination path of copying or moving an item. It uses a minimal
 * version of the file-browser element, which shows the file picker without the toolbar, and
 * without the ability to select files.
 * The dialog returns the user selected directory path, if any.
 */
class DirectoryPickerDialogElement extends BaseDialogElement {

  private static _memoizedTemplate: PolymerTemplate;

  /**
   * Initial value of fileId.
   */
  public fileId: string;

  /**
   * Initial value of input box.
   */
  public fileName: string;

  /**
   * Whether to include an input box under the file picker.
   */
  public withFileName: boolean;

  public readyPromise: Promise<any>;

  static get is() { return 'directory-picker-dialog'; }

  static get properties() {
    return {
      ...super.properties,
      fileId: {
        type: DatalabFileId,
      },
      fileName: {
        type: String,
        value: '',
      },
      withFileName: {
        type: Boolean,
        value: false,
      },
    };
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

  ready() {
    if (!this.readyPromise) {
      super.ready();
      this.readyPromise = this.$.filePicker.ready();
      // We need to notice when the dialog becomes visible so we can rerun our
      // sizing calculations after the dialog opens so that components like the
      // resizable divider make the correct calculations. Without this, those
      // calculations get done before the component is visible, with some zero
      // sizes, so the component does not display properly.
      this.addEventListener('iron-overlay-opened',
        () => { this.resizeHandler(); });
    }
    return this.readyPromise;
  }

  resizeHandler() {
    const picker: FileBrowserElement = this.$.filePicker;
    picker.resizeHandler();
  }

  /**
   * Also send back the user selected path in the closing context.
   */
  getCloseResult() {
    const picker: FileBrowserElement = this.$.filePicker;
    return {
      fileName: this.withFileName ? this.$.fileNameBox.value : undefined,
      selectedDirectory: picker.currentFile,
    };
  }

}

customElements.define(DirectoryPickerDialogElement.is, DirectoryPickerDialogElement);
