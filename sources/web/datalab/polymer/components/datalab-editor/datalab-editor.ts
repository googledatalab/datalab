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

/// <reference path="../datalab-notification/datalab-notification.ts" />

/**
 * Type declarations for CodeMirror
 * TODO: Get these from DefinitelyTyped
 */

interface CodeMirrorOptions {
  value: string;
  mode: string;
  lineNumbers: boolean;
  lineWrapping: boolean;
  theme: string;
}

interface CodeMirrorDoc {
  getValue(): string;
}

interface CodeMirrorEditor {
  doc: CodeMirrorDoc;
  setOption(name: string, value: string): void;
  getOption(name: string): void;
}

declare function CodeMirror(element: HTMLElement, options: CodeMirrorOptions): CodeMirrorEditor;

/**
 * Editor element for Datalab.
 * Contains a <datalab-toolbar> element at the top, and a full screen editor
 * that uses CodeMirror.
 */
class DatalabEditorElement extends Polymer.Element {

  /**
   * Path of the file to load in the editor.
   */
  public filePath: string;

  private _file: JupyterFile | null;
  private _editor: CodeMirrorEditor;
  private _theme: string;
  private _busy: boolean;

  static get is() { return 'datalab-editor'; }

  static get properties() {
    return {
      _busy: {
        type: Boolean,
        value: false
      },
      _file: {
        type: Object,
        value: null,
      },
      filePath: {
        type: String,
        value: '',
      },
    };
  }

  ready() {
    super.ready();

    // Get the theme.
    SettingsManager.getUserSettingsAsync()
      .then((settings: common.UserSettings) => {
        if (settings.theme) {
          this._theme = settings.theme;
        }

        // Get the file contents, or empty string if no path is specified.
        if (this.filePath) {
          this._busy = true;
          // Passing the asText=true parameter guarantees the returned type is not a directory.
          // An error is thrown if it is.
          return ApiManager.getJupyterFile(this.filePath, true /*asText*/)
            .catch((e: Error) => {
              // TODO: Handle error visibly to the user.
              console.log('Could not load specified file: ', e);
              return null;
            });
        } else {
          return null;
        }
      })
      // Create the codemirror element and load the contents in it.
      .then((file: JupyterFile | null) => {
        this._file = file;
        // TODO: try to detect the language of the file before creating
        // the codemirror element. Perhaps use the file extension?
        // TODO: load the mode dynamically instead of starting out with python.
        let content = '';
        if (this._file) {
          content = this._file.content as string;
        }
        this._editor = CodeMirror(this.$.editorContainer,
                                  {
                                    lineNumbers: true,
                                    lineWrapping: true,
                                    mode: 'python',
                                    theme: this._getCodeMirrorTheme(this._theme),
                                    value: content,
                                  });
      })
      .catch((e: Error) => console.log('Error loading file: ' + e))
      .then(() => this._busy = false);
  }

  /**
   * Saves the currently open file.
   */
  _saveAsync() {
    // If the file isn't defined, this means it's a blank editor, we'll need
    // to save a new file. Open a file picker dialog here to get the file path.
    if (!this._file) {
      const options: DirectoryPickerDialogOptions = {
        big: true,
        okLabel: 'Save',
        title: 'New File',
        withFileName: true,
      };
      return Utils.showDialog(DirectoryPickerDialogElement, options)
        .then((closeResult: DirectoryPickerDialogCloseResult) => {
          if (closeResult.confirmed) {

            // TODO: Prevent the dialog from closing if the input field is empty
            if (closeResult.fileName) {
              // TODO: Check if a file exists with this path, and show a
              // confirmation dialog before replacing
              const model: JupyterFile = {
                content: this._editor.doc.getValue(),
                created: new Date().toISOString(),
                format: 'text',
                last_modified: new Date().toISOString(),
                mimetype: 'text/plain',
                name: closeResult.fileName,
                path: closeResult.directoryPath,
                type: 'file',
                writable: true,
              };

              return ApiManager.saveJupyterFile(model)
                .then(() => {
                  this._file = model;
                  return this.dispatchEvent(new NotificationEvent('Saved.'));
                });
                // TODO: Handle save failure here.
            }
          }

          return Promise.resolve(null);
        });
    } else {
    // If _file is defined, we're saving to an existing file
      if (this._file) {
        const filePath = this._file.path;
        const dirPath = filePath.substr(0, filePath.lastIndexOf(this._file.name));

        const model: JupyterFile = {
          content: this._editor.doc.getValue(),
          created: this._file.created,
          format: this._file.format,
          last_modified: new Date().toISOString(),
          mimetype: this._file.mimetype,
          name: this._file.name,
          path: dirPath,
          type: this._file.type,
          writable: this._file.writable,
        };

        return ApiManager.saveJupyterFile(model)
          .then(() => {
            this._file = model;
            return this.dispatchEvent(new NotificationEvent('Saved.'));
          });
        // TODO: Handle save failure here.
      } else {
        return Promise.resolve(null);
      }
    }
  }

  /**
   * Changes the editor theme according to the Datalab theme provided.
   * @param datalabTheme Datalab theme value
   */
  setEditorTheme(datalabTheme: string) {
    this._editor.setOption('theme', this._getCodeMirrorTheme(datalabTheme));
  }

  /**
   * Translates the Datalab theme value (e.g. "light") into one of the
   * CodeMirror's themes. This theme's stylesheet needs to be loaded in
   * the element's light DOM.
   * @param datalabTheme Datalab theme value
   */
  _getCodeMirrorTheme(datalabTheme: string) {
    return datalabTheme === 'dark' ? 'icecoder' : 'eclipse';
  }
}

customElements.define(DatalabEditorElement.is, DatalabEditorElement);
