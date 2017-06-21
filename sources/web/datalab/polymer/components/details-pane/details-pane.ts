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

/// <reference path="../../modules/ApiManager.ts" />

// Instead of writing a .d.ts file containing this one line.
declare function marked(markdown: string): string;

/**
 * Details pane element for Datalab.
 * This element is designed to be displayed in a side bar that displays more
 * information about a selected file.
 */
class DetailsPaneElement extends Polymer.Element {

  /**
   * File whose details to show.
   */
  public file: ApiFile;

  /**
   * Whether the pane is actively tracking selected items. This is used to avoid fetching the
   * selected file's data if the pane is closed by the host element.
   */
  public active: boolean;

  private _textFilePreviewLimit = 30; // Number of lines to preview from plain text files.

  static get is() { return "details-pane"; }

  static get properties() {
    return {
      file: {
        type: Object,
        value: {},
        observer: '_reloadDetails',
      },
      active: {
        type: Boolean,
        value: true,
        observer: '_reloadDetails',
      },
      _icon: {
        type: String,
        computed: '_getIcon(file)',
      },
      _created: {
        type: String,
        computed: '_getCreated(file)',
      },
      _modified: {
        type: String,
        computed: '_getModified(file)',
      },
    }
  }

  /**
   * Loads the details of the given file in the details pane. For directories, the name,
   * icon, and creation and modification dates are shown. For notebooks, the first two
   * cells are pulled from the file, and any markdown they contain is rendered in the pane.
   * For now, we also support other plain text files with mime type text/*, and JSON files.
   * Most of the time, the requests to fetch the selected item's metadata are cached by
   * the browser, and the details show up immediately.
   * 
   * TODO: However, consider adding a spinning animation while this data loads.
   */
  _reloadDetails() {
    if (!this.file || !this.active)
      return;

    if (this.file.type === 'notebook' || this._isPlainTextFile(this.file)) {
      ApiManager.getJupyterFile(this.file.path)
        .then((file: JupyterFile) => {

          // If this is a notebook, get the first two cells and render any markdown in them.
          if (file.type === 'notebook') {
            const cells = (<JupyterNotebookModel>file.content).cells;
            const firstTwoCells = cells.slice(0, 2);

            let markdownHtml = '';
            firstTwoCells.forEach(cell => {
              if (cell.cell_type === 'markdown') {
                markdownHtml += marked(cell.source);
              }
            })
            this.$.previewHtml.innerHTML = markdownHtml;
          // If this is a text file, show the first N lines.
          } else if (this._isPlainTextFile(file)) {
            const lines = (<string>file.content).split('\n');
            this.$.previewHtml.innerText = '\n' +
                lines.slice(0, this._textFilePreviewLimit).join('\n') +
                '\n';
            if (lines.length > this._textFilePreviewLimit) {
              this.$.previewHtml.innerText += '...\n\n';
            }
          }
        })
        .catch(() => {
          this.$.previewHtml.innerHTML = '';
          console.log('Could not get item details.');
        });
    } else {
      this.$.previewHtml.innerHTML = '';
    }
  }

  /**
   * Returns true if the contents of this file can be read as plain text.
   * @param file object for the file whose details to display.
   */
  _isPlainTextFile(file: JupyterFile) {
    return file &&
           file.mimetype && (
             file.mimetype.indexOf('text/') > -1 ||
             file.mimetype.indexOf('application/json') > -1
           );
  }

  _getIcon() {
    if (this.file) {
      return this.file.type === 'directory' ? 'folder' : 'editor:insert-drive-file';
    } else {
      return '';
    }
  }
  _getCreated() {
    return this.file ? new Date(this.file.created).toLocaleDateString() : '';
  }
  _getModified() {
    return this.file ? new Date(this.file.last_modified).toLocaleDateString() : '';
  }

}

customElements.define(DetailsPaneElement.is, DetailsPaneElement);
