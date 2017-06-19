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
/// <reference path="../../../../../../third_party/externs/ts/showdown/showdown.d.ts" />

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

  _reloadDetails() {
    if (!this.file || !this.active)
      return;

    // TODO: Consider caching the rendered HTML for a few minutes or until
    // the next file list refresh

    this.$.previewHtml.innerHTML = '';

    // If this is a notebook, get the first two cells and render them if they're markdown
    if (this.file.type === 'notebook' || this._isPlainTextFile(this.file)) {
      ApiManager.getJupyterFile(this.file.path)
        .then((file: JupyterFile) => {

          if (file.type === 'notebook') {
            const cells = (<JupyterNotebookModel>file.content).cells;
            const firstTwoCells = cells.slice(0, 2);

            let markdownHtml = '';
            const converter = new showdown.Converter();
            firstTwoCells.forEach(cell => {
              if (cell.cell_type === 'markdown') {
                markdownHtml += converter.makeHtml(cell.source);
              }
            })
            if (markdownHtml) {
              this.$.previewHtml.innerHTML = markdownHtml;
            }
          } else if (this._isPlainTextFile(file)) {
            this.$.previewHtml.innerText = '\n' + (<string>file.content).substr(0, 1000) + '\n...\n\n';
          }
        })
        .catch(() => {
          debugger;
        })
    }
  }

  _isPlainTextFile(file: JupyterFile) {
    return file &&
           file.mimetype && (
             file.mimetype.indexOf('text/') > -1 ||
             file.mimetype.indexOf('application/') > -1
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

