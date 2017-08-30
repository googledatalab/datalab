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
  private static _noFileMessage = 'Select an item to view a preview.';
  private static _emptyFileMessage = 'Empty file.';
  private static _longFileMessage = 'Showing the first ' +
      TextPreviewElement._maxLinesInTextSummary + '.';

  /**
   * File whose preview to show.
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
        observer: '_reloadPreview',
        type: Boolean,
        value: true,
      },
      file: {
        observer: '_reloadPreview',
        type: Object,
        value: {},
      },
    };
  }

  /**
   * Previews a text file.
   */
  _reloadPreview() {
    if (!this.file || !this.active) {
      this.$.previewHtml.innerHTML = '';
      this._message = TextPreviewElement._noFileMessage;
      return;
    }

    const fileManager = FileManagerFactory.getInstanceForType(this.file.id.source);
    fileManager.getStringContent(this.file.id)
      .then((content: string) => {
        if (content.trim() === '') {
          this.$.previewHtml.innerHTML = '';
          this._message = TextPreviewElement._emptyFileMessage;
        } else {
          const lines = content.split('\n');
          this._message = 'File with ' + lines.length + ' lines. ';
          this.$.previewHtml.innerText = '\n' +
              lines.slice(0, TextPreviewElement._maxLinesInTextSummary).join('\n') +
              '\n';
          if (lines.length > TextPreviewElement._maxLinesInTextSummary) {
            this.$.previewHtml.innerText += '...\n\n';
            this._message += TextPreviewElement._longFileMessage;
          }
        }
      })
      .catch(() => {
        this.$.previewHtml.innerHTML = '';
        this._message = '';
        Utils.log.error('Could not get text preview.');
      });
  }

}

customElements.define(TextPreviewElement.is, TextPreviewElement);
