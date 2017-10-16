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

/// <reference path="../datalab-notification/datalab-notification.ts" />

/**
 * Shell element for Datalab.
 * It contains a <datalab-toolbar> element at the top, a <datalab-sidebar>
 * element beneath that to the left, and a paged view to switch between
 * different pages. It holds references to the different datalab page
 * elements, and uses a local router element to switch between
 * these according to the current page location.
 * All pages referenced by this element should be named following the
 * convention `datalab-element/datalab-element.html`.
 */
class DatalabAppElement extends Polymer.Element {

  /**
   * The fileId being propagated to and from our pages.
   */
  public fileId: string;

  /**
   * Current displayed page name
   */
  public page: string;

  /**
   * Current matching result from the window.location. This gets re-evaluated
   * every time the current page changes, and can be used to get the current
   * active page's name.
   */
  public routeData: object;

  /**
   * Tail of the parsed route, which contains the file id in its path property.
   */
  public routeTail: object;

  private _boundResizeHandler: EventListenerObject;
  private _fileBrowserSources: string[];

  constructor() {
    super();

    this._boundResizeHandler = this.resizeHandler.bind(this);
    window.addEventListener('resize', this._boundResizeHandler, true);

    ApiManager.disconnectedHandler = () => {
      this.dispatchEvent(new NotificationEvent('Failed to connect to the server.',
                                               true /* show */,
                                               true /* sticky */));
    };

    ApiManager.connectedHandler = () => {
      this.dispatchEvent(new NotificationEvent('', false /* show */));
    };
  }

  static get is() { return 'datalab-app'; }

  static get properties() {
    return {
      _fileBrowserSources: {
        type: Array,
        value: () => [],
      },
      fileId: {
        observer: '_fileIdChanged',
        type: String,
      },
      page: {
        observer: '_pageChanged',
        type: String,
        value: '',
      },
      routeData: Object,
      routeTail: {
        notify: true,
        type: Object,
      },
    };
  }

  static get observers() {
    return [
      // We need a complex observer for changes to the routeData object's page
      // property, and the path property of routeTail, which contains the file
      // id.
      '_routePageChanged(routeData.page)',
      '_routeTailPathChanged(routeTail.path)',
    ];
  }

  async ready() {
    super.ready();

    window.addEventListener('focus', () => this.focusHandler());

    const settings = await SettingsManager.getAppSettingsAsync();
    this._fileBrowserSources = settings.supportedFileBrowserSources;
  }

  /**
   * Called when the element is detached from the DOM. Cleans up event listeners.
   */
  disconnectedCallback() {
    if (this._boundResizeHandler) {
      window.removeEventListener('resize', this._boundResizeHandler);
    }
  }

  _fileIdChanged() {
    this.set('routeTail.path', this.fileId);
  }

  /**
   * On changes to the current route, explicitly sets the page property
   * so it can be used by other elements.
   */
  _routePageChanged(page: string) {
    this.page = page;
  }

  _routeTailPathChanged() {
    let path = (this.routeTail as any).path as string;
    if (path.startsWith('/')) {
      path = path.substr(1);
    }
    this.fileId = path;
  }

  /**
   * On changes to the page property, resolves the new page's uri, and
   * tells Polymer to load it.
   * We do this to lazy load pages as the user clicks them instead of letting
   * the browser pre-load all the pages on the first request.
   */
  _pageChanged(newPage: string, oldPage: string) {
    if (newPage) {
      // Lazy load the requested page. Build the path using the page's element
      // name.
      const newElement = this._getPageElement(newPage);
      const elName = newElement.tagName.toLowerCase();
      const resolvedPageUrl = this.resolveUrl('../' + elName + '/' + elName + '.html');

      Polymer.importHref(resolvedPageUrl, () => {
        // After the element has loaded, call proper event handlers on it.
        if (newElement.focusHandler) {
          newElement.focusHandler();
        }
        if (newElement.resizeHandler) {
          newElement.resizeHandler();
        }
      }, undefined, true);

    }

    if (oldPage) {
      const oldElement = this._getPageElement(oldPage);
      // Call proper event handlers on old page, which should already exist.
      if (oldElement && oldElement.blurHandler) {
        oldElement.blurHandler();
      }
    }
  }

  /**
   * Given a page name, returns its HTML element.
   * @param pageName name of the page whose element to return
   */
  _getPageElement(pageName: string) {
    return this.$.pages.querySelector('[name=' + pageName + ']') as DatalabPageElement;
  }

  /**
   * If the selected page has a resize handler, calls it.
   */
  resizeHandler() {
    const selectedPage = this.$.pages.selectedItem;
    if (selectedPage && selectedPage.resizeHandler) {
      selectedPage.resizeHandler();
    }
  }

  /**
   * If the selected page has a focus handler, calls it.
   */
  focusHandler() {
    const selectedPage = this.$.pages.selectedItem;
    if (selectedPage && selectedPage.focusHandler) {
      selectedPage.focusHandler();
    }
  }

}

customElements.define(DatalabAppElement.is, DatalabAppElement);
