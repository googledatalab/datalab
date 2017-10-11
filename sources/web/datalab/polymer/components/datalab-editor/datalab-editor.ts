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
   * FileId object for the file to load in the editor.
   */
  public fileId: DatalabFileId | null;

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
      fileId: {
        notify: true,
        observer: '_loadFile',
        type: Object,
        value: '',
      },
    };
  }

  async ready() {
    super.ready();

    // Get the theme.
    const settings = await SettingsManager.getUserSettingsAsync()
      .catch(() => Utils.log.error('Could not load user settings.'));

    if (settings && settings.theme) {
      this._theme = settings.theme;
    }

    // Create the codemirror element and fill it with the file content.
    // TODO: try to detect the language of the file before creating
    //       the codemirror element. Perhaps use the file extension?
    // TODO: load the mode dynamically instead of starting out with python.
    const editorConfig: CodeMirror.EditorConfiguration = {
      autofocus: true,
      lineNumbers: true,
      lineWrapping: true,
      mode: 'python',
      theme: this._getCodeMirrorTheme(this._theme),
      value: '',
    };

    this._editor = CodeMirror(this.$.editorContainer, editorConfig);
    this._loadFile();
  }

  async _saveClicked() {
    await this._saveAsync()
      .catch((e) => Utils.log.error(e.message));
    this._editor.focus();
  }

  async _renameClicked() {
    await this._renameAsync()
      .catch((e) => Utils.log.error(e.message));
    this._editor.focus();
  }

  async _downloadClicked() {
    await this._download();
    this._editor.focus();
  }

  async _loadFile() {
    // Get the file contents, or empty string if no path is specified or the
    // file could not be found.
    let content = '';
    if (this.fileId) {
      this._busy = true;
      try {
        this._fileManager = FileManagerFactory.getInstanceForType(this.fileId.source);

        // Get the file object and its contents
        this._file = await this._fileManager.get(this.fileId);
        content = await this._fileManager.getStringContent(this.fileId, true /*asText*/);
      } catch (e) {
        Utils.showErrorDialog('Error loading file', e.message);
        this.fileId = null;
      }

      this._busy = false;
    } else {
      // TODO: Make this more flexible instead of assuming the default
      // destination is jupyter. If there's no fileId specified (blank editor),
      // we should ask the user on save about the file destination.
      this._fileManager = FileManagerFactory.getInstanceForType(FileManagerType.JUPYTER);
    }

    // The editor will be undefined when this method is first called by the observer.
    if (this._editor) {
      this._editor.getDoc().setValue(content);

      // Sometimes needed to fix gutter render issues.
      // See https://github.com/JedWatson/react-codemirror/issues/6.
      this._editor.refresh();
      this._editor.focus();
    }
  }

  _download() {
    if (this._file) {
      // This works by creating an invisible anchor element that points to the
      // contents of the editor, and clicking it, then removing it from the DOM.
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', 'data:text/plain;charset=utf-8,' +
          encodeURIComponent(this._editor.getDoc().getValue()));
      downloadAnchor.setAttribute('download', this._file.name);
      downloadAnchor.style.display = 'none';
      document.body.appendChild(downloadAnchor);

      downloadAnchor.click();

      document.body.removeChild(downloadAnchor);
    }
  }

  /**
   * Saves the currently open file.
   */
  async _saveAsync() {
    // If the file isn't defined, this means it's a blank editor, we'll need
    // to save a new file. Open a file picker dialog here to get the file path.
    if (!this._file) {
      const options: DirectoryPickerDialogOptions = {
        big: true,
        okLabel: 'Save',
        title: 'New File',
        withFileName: true,
      };
      const closeResult = await Utils.showDialog(DirectoryPickerDialogElement, options) as
          DirectoryPickerDialogCloseResult;

      if (closeResult.confirmed) {
        // TODO: Prevent the dialog from closing if the input field is empty
        if (closeResult.fileName) {
          try {
            this._file = await this._fileManager.create(DatalabFileType.FILE,
                closeResult.selectedDirectory.id, closeResult.fileName);
            this.fileId = this._file.id;
          } catch (e) {
            Utils.showErrorDialog('Error saving file', 'A file with the name ' +
                closeResult.fileName + ' already exists in this directory.');
            throw e;
          }
        }
      }
    } else {
      // If _file is defined, we're saving to an existing file
      if (this._file.type === DatalabFileType.DIRECTORY) {
        // We can only save text files.
        Utils.showErrorDialog('Error Saving', 'Cannot save edits to directories.');
        return;
      }
    }
    if (this._file) {
      await this._fileManager.saveText(this._file, this._editor.getDoc().getValue());
      await this.dispatchEvent(new NotificationEvent('Saved.'));
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
        this._fileManager.rename(this.fileId as DatalabFileId, closeResult.userInput)
          .then((_savedModel) => {
            this._file = _savedModel;
            this.fileId = this._file.id;
            this.dispatchEvent(new NotificationEvent('Renamed to ' + closeResult.userInput));
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
