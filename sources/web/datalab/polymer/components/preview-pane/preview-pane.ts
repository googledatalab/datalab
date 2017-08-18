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
 * Preview pane element for Datalab.
 * This element is designed to be displayed in a side bar that displays more
 * information about a selected file.
 */
class PreviewPaneElement extends Polymer.Element {

  /**
   * Currently displayed preview pane.
   */
  public preview: string;

  /**
   * File whose preview to show.
   */
  public file: DatalabFile;

  /**
   * Whether the pane is actively tracking selected items. This is used to avoid fetching the
   * selected file's data if the pane is closed by the host element.
   */
  public active: boolean;

  static get is() { return 'preview-pane'; }

  static get properties() {
    return {
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
      preview: {
        type: String,
        value: '',
      },
    };
  }

  /**
   * Shows a preview of the selected file for known file types.
   *
   * TODO: Consider adding a spinning animation while this data loads.
   */
  _reloadPreview() {
    if (!this.file || !this.active) {
      return;
    }

    this.preview = this.file.getPreviewName();

    if (this.preview) {
      const elName = this.preview + '-preview';
      const pageUrl = this.resolveUrl('../' + elName + '/' + elName + '.html');
      Polymer.importHref(pageUrl, undefined, undefined, true);
    }
  }
}

customElements.define(PreviewPaneElement.is, PreviewPaneElement);
