/// <reference path='../../../../../../third_party/externs/ts/polymer/polymer.d.ts' />

/**
 * Toolbar element for Datalab.
 * This element is a horizontal bar that goes at the top of the page, and
 * contains the Datalab logo, plus a few icons that are meant to persist
 * on all pages. It also contains dialogs that are opened by those buttons
 */
class ToolbarElement extends Polymer.Element {

  static get is() { return "datalab-toolbar"; }

  /**
   * Open the info dialog
   */
  _infoClicked() {
    this.$.infoDialog.open();
  }

  /**
   * Open the settings dialog
   */
  _settingsClicked() {
    this.$.settingsDialog.open();
  }

}

customElements.define(ToolbarElement.is, ToolbarElement);

