/// <reference path='../../../../../../third_party/externs/ts/polymer/polymer.d.ts' />

/**
 * Shell element for Datalab.
 * It contains a <datalab-toolbar> element at the top, a <datalab-sidebar>
 * element beneath that to the left, and a paged view to switch between
 * different pages. It holds references to <datalab-files> and
 * <datalab-sessions>, and uses a local router element to switch between
 * these according to the current page location
 * All pages referenced by this element should be named following the
 * convention `datalab-element/datalab-element.html`
 */
class DatalabAppElement extends Polymer.Element {

  /**
   * current displayed page name
   */
  public page: string;

  /**
   * pattern for extracting current pathname component. This is matched
   * against current location to extract the page name
   */
  public rootPattern: string;

  /**
   * current matching result from the window.location against the
   * root pattern. This gets re-evaluated every time the current page
   * changes, and can be used to get the current active page's name
   */
  public routeData: Object;

  constructor() {
    super();

    // set the pattern once to be the current document pathname
    this.rootPattern = (new URL(this.rootPath)).pathname;
  }

  static get is() { return 'datalab-app'; }

  static get properties() {
    return {
      page: {
        type: String,
        value: 'files',
        observer: '_pageChanged'
      },
      rootPattern: String,
      routeData: Object,
    }
  }

  static get observers() {
    return [
      // need a complex observer for changes to the routeData
      // object's page property
      '_routePageChanged(routeData.page)',
    ];
  }

  /**
   * on changes to the current route, explicitly set the page property
   * so it can be used by other elements
   */
  _routePageChanged(page: string) {
    // default to the files view
    this.page = page || 'files';
  }

  /**
   * on changes to the page property, resolve the new page's uri, and
   * tell Polymer to load it.
   * we do this to lazy load pages as the user clicks them for performance
   */
  _pageChanged(page: string) {
    // build the path using the page name as suffix for directory
    // and file names
    let subpath = 'datalab-' + page
    var resolvedPageUrl = this.resolveUrl('../' + subpath + '/' + subpath + '.html');
    Polymer.importHref(resolvedPageUrl, null, null, true);
  }

}

customElements.define(DatalabAppElement.is, DatalabAppElement);
