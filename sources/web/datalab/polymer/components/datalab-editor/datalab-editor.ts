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
 * Type declaration for CodeMirror
 */
declare function CodeMirror (element: HTMLElement, options: any): HTMLElement;

/**
 * Shell element for the Datalab Editor.
 * It contains a <datalab-toolbar> element at the top, and a full screen editor
 * that uses CodeMirror.
 */
class DatalabEditorElement extends Polymer.Element {

  private _editor: any;
  private _theme: string;
  private _fetching: boolean;

  static get is() { return 'datalab-editor'; }

  static get properties() {
    return {
      _fetching: {
        type: Boolean,
        value: false
      },
    }
  }

  ready() {
    super.ready();

    SettingsManager.getUserSettingsAsync()
      .then((settings: common.UserSettings) => {
      if (settings.theme) {
        this._theme = settings.theme;
      }
      })
      .then(() => {
        this._editor = CodeMirror(this.$.editorContainer,
                                  {
                                    value: 'some code',
                                    mode: 'python',
                                    lineNumbers: true,
                                    theme: this._getThemeValue(this._theme),
                                  });
      });

    document.addEventListener('ThemeChanged', (e: CustomEvent) => {
      if (e && e.detail) {
        this._editor.setOption('theme', this._getThemeValue(e.detail));
      }
    });

    this._fetching = false;
  }

  _getThemeValue(datalabTheme: string) {
    return datalabTheme === 'dark' ? 'icecoder' : '';
  }

}

customElements.define(DatalabEditorElement.is, DatalabEditorElement);

