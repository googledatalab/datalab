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
 * Shell element for Datalab.
 * It contains a <datalab-toolbar> element at the top, a <datalab-sidebar>
 * element beneath that to the left, and a paged view to switch between
 * different pages. It holds references to <datalab-files> and
 * <datalab-sessions>, and uses a local router element to switch between
 * these according to the current page location.
 * All pages referenced by this element should be named following the
 * convention `datalab-element/datalab-element.html`.
 */
class DatalabAppElement extends Polymer.Element {

  /**
   * Current displayed page name
   */
  public page: string;

  /**
   * Pattern for extracting current pathname component. This is matched
   * against current location to extract the page name.
   */
  public rootPattern: string;

  /**
   * Current matching result from the window.location against the
   * root pattern. This gets re-evaluated every time the current page
   * changes, and can be used to get the current active page's name.
   */
  public routeData: Object;

  constructor() {
    super();

    // Set the pattern once to be the current document pathname.
    this.rootPattern = (new URL(this.rootPath)).pathname;
  }

  static get is() { return 'datalab-app'; }

  static get properties() {
    return {
      page: {
        type: String,
        value: 'files',
        observer: '_pageChanged',
      },
      rootPattern: String,
      routeData: Object,
    }
  }

  static get observers() {
    return [
      // We need a complex observer for changes to the routeData
      // object's page property.
      '_routePageChanged(routeData.page)',
    ];
  }

  /**
   * On changes to the current route, explicitly sets the page property
   * so it can be used by other elements.
   */
  _routePageChanged(page: string) {
    // Defaults to the files view
    this.page = page || 'files';
  }

  /**
   * On changes to the page property, resolves the new page's uri, and
   * tells Polymer to load it.
   * We do this to lazy load pages as the user clicks them instead of letting
   * the browser pre-load all the pages on the first request.
   */
  _pageChanged(page: string) {
    // Build the path using the page name as suffix for directory
    // and file names.
    const subpath = 'datalab-' + page
    const resolvedPageUrl = this.resolveUrl('../' + subpath + '/' + subpath + '.html');
    Polymer.importHref(resolvedPageUrl, undefined, undefined, true);
  }

}

customElements.define(DatalabAppElement.is, DatalabAppElement);

