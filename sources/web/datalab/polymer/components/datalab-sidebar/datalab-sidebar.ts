/**
 * Sidebar element for Datalab.
 * This element puts a side bar on the left side that contains links to
 * different pages, and exposes a two-way bound 'page' property
 */
class SidebarElement extends Polymer.Element {

  static get is() { return "datalab-sidebar"; }

  static get properties() {
    return {
      page: {
        type: String,
        value: "files"
      }
    }
  }

}

customElements.define(SidebarElement.is, SidebarElement);
