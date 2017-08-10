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
/// <reference path="../../node_modules/@types/codemirror/index.d.ts" />

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

  private _busy: boolean;
  private _editor: CodeMirror.Editor;
  private _file: DatalabFile | null;
  private _fileManager: FileManager;
  private _theme: string;

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
        notify: true,
        type: String,
        value: '',
      },
    };
  }

  async ready() {
    super.ready();

    // TODO: This should get the FileManager instance that corresponds to the
    // origin of the file opened in the editor
    this._fileManager = FileManagerFactory.getInstance();

    // Get the theme.
    const settings = await SettingsManager.getUserSettingsAsync()
      .catch(() => console.error('Could not load user settings.'));

    if (settings && settings.theme) {
      this._theme = settings.theme;
    }

    // Get the file contents, or empty string if no path is specified
    let content = '';
    if (this.filePath) {
      this._busy = true;
      // Passing the asText=true parameter guarantees the returned type is not a directory.
      // An error is thrown if it is.
      this._file = await this._fileManager.get(this.filePath, true /*asText*/)
        .catch((e: Error) => {
          Utils.showErrorDialog('Error', e.message);
          return null;
        });

      this._busy = false;

      if (this._file) {
        content = this._file.content as string;
      }
    }

    // Create the codemirror element and fill it with the file content.
    // TODO: try to detect the language of the file before creating
    // the codemirror element. Perhaps use the file extension?
    // TODO: load the mode dynamically instead of starting out with python.
    const editorConfig: CodeMirror.EditorConfiguration = {
      autofocus: true,
      lineNumbers: true,
      lineWrapping: true,
      mode: 'python',
      theme: this._getCodeMirrorTheme(this._theme),
      value: content,
    };

    this._editor = CodeMirror(this.$.editorContainer, editorConfig);
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
              const model: DatalabFile = {
                content: this._editor.getDoc().getValue(),
                created: new Date().toISOString(),
                format: 'text',
                last_modified: new Date().toISOString(),
                mimetype: 'text/plain',
                name: closeResult.fileName,
                path: closeResult.directoryPath,
                status: DatalabFileStatus.IDLE,
                type: DatalabFileType.FILE,
                writable: true,
              };

              return this._saveToJupyterAsync(model);
            }
          }

          return Promise.resolve(null);
        });
    } else {
      // If _file is defined, we're saving to an existing file
      const dirPath = this._getDirNameFromPath(this._file.path);

      const model: DatalabFile = {
        content: this._editor.getDoc().getValue(),
        created: this._file.created,
        format: this._file.format,
        last_modified: new Date().toISOString(),
        mimetype: this._file.mimetype,
        name: this._file.name,
        path: dirPath,
        status: DatalabFileStatus.IDLE,
        type: this._file.type,
        writable: this._file.writable,
      };

      return this._saveToJupyterAsync(model);
    }
  }

  /**
   * Returns the directory containing a file given its full path.
   */
  _getDirNameFromPath(path: string) {
    const tokens = path.split('/');
    tokens.pop();
    return tokens.join('/');
  }

  /**
   * Saves the given file model to Jupyter, and fetches the save result to keep
   * the client's _file object up to date.
   */
  _saveToJupyterAsync(model: DatalabFile) {
    return this._fileManager.save(model)
      .then((savedModel: DatalabFile) => {
        this._file = model;
        // Get the path and name from the saved model. The path is returned
        // without the file name from Jupyter
        this.set('_file.name', savedModel.name);
        this.set('_file.path', savedModel.path);
        this.set('filePath', savedModel.path);
        this.filePath = this._file.path;
        return this.dispatchEvent(new NotificationEvent('Saved.'));
      })
      .catch((e: Error) => Utils.showErrorDialog('Error', e.message));
  }

  /**
   * Rename the currently open file.
   */
  async _renameAsync() {
    // If the open file isn't saved, save it instead
    if (!this._file) {
      this._saveAsync();
    } else {
      const options: InputDialogOptions = {
        inputLabel: 'New file name',
        inputValue: this._file.name,
        okLabel: 'Rename',
        title: 'Rename File',
      };

      const closeResult =
          await Utils.showDialog(InputDialogElement, options) as InputDialogCloseResult;

      // TODO: Prevent the dialog from closing if the input field is empty
      if (closeResult.confirmed && closeResult.userInput) {
        const file = this._file as DatalabFile;
        const oldPath = file.path;
        const newPath = this._getDirNameFromPath(file.path) + '/' + closeResult.userInput;

        this._fileManager.rename(oldPath, newPath)
          .then((savedModel) => {
            this.dispatchEvent(new NotificationEvent('Renamed ' + oldPath + ' to ' + newPath));
            this.set('_file.name', savedModel.name);
            this.set('_file.path', savedModel.path);
            this.set('filePath', savedModel.path);
          })
          .catch((e: Error) => Utils.showErrorDialog('Error', e.message));
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
