/**
 * Details pane element for Datalab.
 * This element is designed to be displayed in a side bar that displays more
 * information about a selected item
 */
class DetailsPaneElement extends Polymer.Element {

  static get is() { return "details-pane"; }

  static get properties() {
    return {
      item: {
        type: Object,
        value: {}
      },
      icon: {
        type: String,
        value: ''
      }
    }
  }

}

customElements.define(DetailsPaneElement.is, DetailsPaneElement);

