/// <reference path='../../../../../../third_party/externs/ts/polymer/polymer.d.ts' />

/**
 * Interface representing a row in the item list
 */
interface row {
  firstCol: string,
  secondCol: string,
  icon: string,
  selected: boolean
}

/**
 * Two-column list element.
 * This element takes a list of two column names, and a list of row
 * objects, each containing values for each of the columns, an icon
 * name, and a selected property. The items are displayed in a table
 * form. Clicking an item selects it and unselects all other items.
 * Clicking the checkbox next to an item allows for multi-selection.
 * Double clicking an item fires a 'itemDblClick' event with this
 * item's index
 */
class ItemListElement extends Polymer.Element {

  /**
   * list of data rows, each implementing the row interface
   */
  public rows: Array<row>;

  /**
   * list of string data columns names
   */
  public columns: Array<string>;

  static get is() { return "item-list"; }

  static get properties() {
    return {
      rows: {
        type: Array,
        value: function(): Array<Object> {
          return [];
        },
        observer: '_rowsChanged'
      },
      columns: {
        type: Array,
        value: function(): Array<string> {
          return [];
        }
      }
    }
  }

  _rowsChanged() {
    debugger;
  }

  /**
   * on row click, check the click target, if it's the checkbox, add it to
   * the selected rows, otherwise select it only
   */
  _rowClicked(e: MouseEvent) {
    const target = <HTMLDivElement>e.target;
    const index = this.$.list.indexForElement(target);
    const selected = this.rows[index].selected;

    // if the clicked element is the checkbox, we're done, the checkbox already
    // toggles selection (see the dom-repeat template)
    // otherwise, select this element, unselect all others
    if (target.tagName !== 'PAPER-CHECKBOX') {
      for (let i = 0; i < this.rows.length; ++i) {
        this.set('rows.' + i + '.selected', false);
      }
      this.set('rows.' + index + '.selected', true);
    }
  }

  /**
   * on row double click, fire an event with the clicked item's index
   */
  _rowDblClicked(e: MouseEvent) {
    const index = this.$.list.indexForElement(e.target);
    this.dispatchEvent(new CustomEvent('itemDblClick', {detail: {index: index}}));
  }

}

customElements.define(ItemListElement.is, ItemListElement);

