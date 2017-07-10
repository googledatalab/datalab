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
 * Type declarations for CodeMirror
 */

interface CodeMirrorOptions {
  value: string,
  mode: string,
  lineNumbers: boolean,
  lineWrapping: boolean,
  theme: string,
}

interface CodeMirrorEditor {
  setOption(name: string, value: string): void;
  getOption(name: string): void;
}

declare function CodeMirror (element: HTMLElement, options: CodeMirrorOptions): CodeMirrorEditor;

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
      filePath: {
        type: String,
        value: '',
      },
      _file: {
        type: Object,
        value: null,
      },
      _busy: {
        type: Boolean,
        value: false
      },
    }
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
            })
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
          content = <string>this._file.content;
        }
        this._editor = CodeMirror(this.$.editorContainer,
                                  {
                                    value: content,
                                    mode: 'python',
                                    lineNumbers: true,
                                    lineWrapping: true,
                                    theme: this._getCodeMirrorTheme(this._theme),
                                  });
      })
      .catch((e: Error) => console.log('Error loading file: ' + e))
      .then(() => this._busy = false);
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
