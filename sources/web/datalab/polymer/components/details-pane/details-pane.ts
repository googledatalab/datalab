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

// Instead of writing a .d.ts file containing this one line.
declare function marked(markdown: string): string;

/**
 * Details pane element for Datalab.
 * This element is designed to be displayed in a side bar that displays more
 * information about a selected file.
 */
class DetailsPaneElement extends Polymer.Element {

  private static _maxLinesInTextSummary = 30;
  private static _noFileMessage = 'Select an item to view its details.';
  private static _emptyFileMessage = 'Empty file.';
  private static _emptyNotebookMessage = 'Empty notebook.';
  private static _longNotebookMessage = 'Showing markdown from the first two.';
  private static _longFileMessage = 'Showing the first ' +
      DetailsPaneElement._maxLinesInTextSummary + '.';

  /**
   * File whose details to show.
   */
  public file: DatalabFile;

  /**
   * Whether the pane is actively tracking selected items. This is used to avoid fetching the
   * selected file's data if the pane is closed by the host element.
   */
  public active: boolean;

  private _fileManager: FileManager;
  private _message = ''; // To show in the placeholder field.

  static get is() { return 'details-pane'; }

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

  constructor() {
    super();

    this._fileManager = FileManagerFactory.getInstance();
  }

  ready() {
    this._message = DetailsPaneElement._noFileMessage;
    super.ready();
  }

  /**
   * Loads the details of the given file in the details pane. No preview is shown if the
   * selected item is a directory. For notebooks, the first two cells are pulled from the file,
   * and any markdown they contain is rendered in the pane. For now, we also support other
   * plain text files with mime type text/*, and JSON files.
   *
   * TODO: Consider adding a spinning animation while this data loads.
   */
  _reloadDetails() {
    if (!this.file || !this.active) {
      this._message = DetailsPaneElement._noFileMessage;
      return;
    }

    if (this.file.type === DatalabFileType.NOTEBOOK || this._isPlainTextFile(this.file)) {
      this._fileManager.getContent(this.file.id)
        .then((content: DatalabFileContent) => {

          // If this is a notebook, get the first two cells and render any markdown in them.
          if (content instanceof NotebookContent) {
            if (content.cells.length === 0) {
              this.$.previewHtml.innerHTML = '';
              this._message = DetailsPaneElement._emptyNotebookMessage;
            } else {
              const firstTwoCells = content.cells.slice(0, 2);

              let markdownHtml = '';
              firstTwoCells.forEach((cell) => {
                if (cell.cell_type === 'markdown') {
                  markdownHtml += marked(cell.source);
                }
              });
              this.$.previewHtml.innerHTML = markdownHtml;
              this._message = ' Notebook with ' + content.cells.length + ' cells. ';
              if (content.cells.length > 2) {
                this._message += DetailsPaneElement._longNotebookMessage;
              }
            }

          // If this is a text file, show the first N lines.
          } else if (content instanceof TextContent) {

            if (content.text.trim() === '') {
              this.$.previewHtml.innerHTML = '';
              this._message = DetailsPaneElement._emptyFileMessage;
            } else {
              const lines = content.text.split('\n');
              this._message = 'File with ' + lines.length + ' lines. ';
              this.$.previewHtml.innerText = '\n' +
                  lines.slice(0, DetailsPaneElement._maxLinesInTextSummary).join('\n') +
                  '\n';
              if (lines.length > DetailsPaneElement._maxLinesInTextSummary) {
                this.$.previewHtml.innerText += '...\n\n';
                this._message += DetailsPaneElement._longFileMessage;
              }
            }
          }
        })
        .catch(() => {
          this.$.previewHtml.innerHTML = '';
          this._message = '';
          console.log('Could not get item details.');
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

customElements.define(DetailsPaneElement.is, DetailsPaneElement);
