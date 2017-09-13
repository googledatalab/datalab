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
 * InlineDetails pane element for Datalab.
 * This element is designed to be displayed in a side bar that displays more
 * information about a selected file.
 */
class InlineDetailsPaneElement extends Polymer.Element {

  /**
   * Currently displayed inline-details pane name.
   */
  public details: string;

  /**
   * File whose details to show.
   */
  public file: DatalabFile;

  /**
   * Whether the pane is actively tracking selected items. This is used to avoid fetching the
   * selected file's data if the pane is closed by the host element.
   */
  public active: boolean;

  static get is() { return 'inline-details-pane'; }

  static get properties() {
    return {
      active: {
        observer: '_reloadInlineDetails',
        type: Boolean,
        value: true,
      },
      details: {
        type: String,
        value: '',
      },
      file: {
        observer: '_reloadInlineDetails',
        type: Object,
        value: {},
      },
    };
  }

  /**
   * Shows inline details of the selected file for known file types.
   *
   * TODO: Consider adding a spinning animation while this data loads.
   */
  _reloadInlineDetails() {
    if (!this.file || !this.active) {
      return;
    }

    this.details = this.file.getInlineDetailsName();
    if (this.details) {
      const elName = this.details + '-inline-details';
      const pageUrl = this.resolveUrl('../' + elName + '/' + elName + '.html');
      Polymer.importHref(pageUrl, undefined, undefined, true);
    }
  }
}

customElements.define(InlineDetailsPaneElement.is, InlineDetailsPaneElement);
