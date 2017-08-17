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
 * Text preview element for Datalab.
 */
class TextPreviewElement extends Polymer.Element {

  private static _maxLinesInTextSummary = 30;
  private static _noFileMessage = 'Select an item to view its details.';
  private static _emptyFileMessage = 'Empty file.';
  private static _longFileMessage = 'Showing the first ' +
      TextPreviewElement._maxLinesInTextSummary + '.';

  /**
   * File whose details to show.
   */
  public file: DatalabFile;

  /**
   * Whether the pane is actively tracking selected items. This is used to avoid fetching the
   * selected file's data if the pane is closed by the host element.
   */
  public active: boolean;

  private _message = '';

  static get is() { return 'text-preview'; }

  static get properties() {
    return {
      _message: {
        type: String,
        value: '',
      },
      active: {
        observer: '_reloadDetails',
        type: Boolean,
        value: true,
      },
      file: {
        observer: '_reloadDetails',
        type: Object,
        value: {},
      },
    };
  }

  /**
   * Previews a text file.
   */
  _reloadDetails() {
    if (!this.file || !this.active) {
      this._message = TextPreviewElement._noFileMessage;
      return;
    }

    if (this._isPlainTextFile(this.file)) {
      const fileManager = FileManagerFactory.getInstanceForType(this.file.id.source);
      fileManager.getContent(this.file.id)
        .then((content: DatalabContent) => {

          // If this is a text file, show the first N lines.
          if (content instanceof TextContent) {

            if (content.text.trim() === '') {
              this.$.previewHtml.innerHTML = '';
              this._message = TextPreviewElement._emptyFileMessage;
            } else {
              const lines = content.text.split('\n');
              this._message = 'File with ' + lines.length + ' lines. ';
              this.$.previewHtml.innerText = '\n' +
                  lines.slice(0, TextPreviewElement._maxLinesInTextSummary).join('\n') +
                  '\n';
              if (lines.length > TextPreviewElement._maxLinesInTextSummary) {
                this.$.previewHtml.innerText += '...\n\n';
                this._message += TextPreviewElement._longFileMessage;
              }
            }
          }
        })
        .catch(() => {
          this.$.previewHtml.innerHTML = '';
          this._message = '';
          Utils.log.error('Could not get item details.');
        });
    } else {
      this.$.previewHtml.innerHTML = '';
      this._message = '';
    }
  }

  /**
   * Returns true if the contents of this file can be read as plain text.
   * @param file object for the file whose details to display.
   */
  _isPlainTextFile(file: DatalabFile) {
    if (file instanceof JupyterFile) {
      return file &&
            file.mimetype && (
              file.mimetype.indexOf('text/') > -1 ||
              file.mimetype.indexOf('application/json') > -1
            );
    } else {
      return false;
    }
  }

}

customElements.define(TextPreviewElement.is, TextPreviewElement);
