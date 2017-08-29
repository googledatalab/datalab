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

// TODO(jimmc) - consider creating a common superclass, such as item-preview,
// for notebook-preview and the other preview classes, to contain common
// elements such as message and active.

/**
 * Notebook preview element for Datalab.
 */
class NotebookPreviewElement extends Polymer.Element {

  private static _noFileMessage = 'Select an item to view a preview.';
  private static _emptyNotebookMessage = 'Empty notebook.';
  private static _longNotebookMessage = 'Showing markdown from the first two.';

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

  static get is() { return 'notebook-preview'; }

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
   * Loads the preview of the given file in the preview pane. No preview is shown if the
   * selected item is a directory. For notebooks, the first two cells are pulled from the file,
   * and any markdown they contain is rendered in the pane. For now, we also support other
   * plain text files with mime type text/*, and JSON files.
   *
   * TODO: Consider adding a spinning animation while this data loads.
   */
  _reloadPreview() {
    if (!this.file || !this.active ||
        this.file.type !== DatalabFileType.NOTEBOOK) {
      this.$.previewHtml.innerHTML = '';
      this._message = NotebookPreviewElement._noFileMessage;
      return;
    }

    const fileManager = FileManagerFactory.getInstanceForType(this.file.id.source);
    fileManager.getContent(this.file.id)
      .then((content: DatalabContent) => {

        // If this is a notebook, get the first two cells and render any markdown in them.
        if (content instanceof NotebookContent) {
          if (content.cells.length === 0) {
            this.$.previewHtml.innerHTML = '';
            this._message = NotebookPreviewElement._emptyNotebookMessage;
          } else {
            const firstTwoCells = content.cells.slice(0, 2);

            let markdownHtml = '';
            firstTwoCells.forEach((cell) => {
              if (cell.cell_type === 'markdown') {
                markdownHtml += marked(cell.source.toString());
              }
            });
            this.$.previewHtml.innerHTML = markdownHtml;
            this._message = ' Notebook with ' + content.cells.length + ' cells. ';
            if (content.cells.length > 2) {
              this._message += NotebookPreviewElement._longNotebookMessage;
            }
          }
        }
      })
      .catch(() => {
        this.$.previewHtml.innerHTML = '';
        const message = 'Could not get notebook preview.';
        this._message = message;
        Utils.log.error(message);
      });
  }

}

customElements.define(NotebookPreviewElement.is, NotebookPreviewElement);
