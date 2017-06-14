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
 * Interface representing a row in the item list
 */
interface ItemListRow {
  firstCol: string,
  secondCol: string,
  icon: string,
  selected: boolean
}

/**
 * CustomEvent that gets dispatched when an item is clicked or double clicked
 */
class ItemClickEvent extends CustomEvent {
  detail: {
    index: number
  }
}

/**
 * Two-column list element.
 * This element takes a list of two column names, and a list of row
 * objects, each containing values for each of the columns, an icon
 * name, and a selected property. The items are displayed in a table
 * form. Clicking an item selects it and unselects all other items.
 * Clicking the checkbox next to an item allows for multi-selection.
 * Double clicking an item fires a 'itemDoubleClick' event with this
 * item's index
 */
class ItemListElement extends Polymer.Element {

  /**
   * list of data rows, each implementing the row interface
   */
  public rows: Array<ItemListRow>;

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
      },
      columns: {
        type: Array,
        value: function(): Array<string> {
          return [];
        }
      }
    }
  }

  /**
   * on row click, check the click target, if it's the checkbox, add it to
   * the selected rows, otherwise select it only
   */
  _rowClicked(e: MouseEvent) {
    const target = <HTMLDivElement>e.target;
    const index = this.$.list.indexForElement(target);

    // if the clicked element is the checkbox, we're done, the checkbox already
    // toggles selection (see the dom-repeat template)
    // otherwise, select this element, unselect all others
    if (target.tagName !== 'PAPER-CHECKBOX') {
      for (let i = 0; i < this.rows.length; ++i) {
        this.set('rows.' + i + '.selected', false);
      }
      this.set('rows.' + index + '.selected', true);
    }
    const ev = new ItemClickEvent('itemSelectionChanged', { detail: {index: index} });
    this.dispatchEvent(ev);
  }

  /**
   * on row double click, fire an event with the clicked item's index
   */
  _rowDoubleClicked(e: MouseEvent) {
    const index = this.$.list.indexForElement(e.target);
    const ev = new ItemClickEvent('itemDoubleClick', { detail: {index: index} });
    this.dispatchEvent(ev);
  }

}

customElements.define(ItemListElement.is, ItemListElement);

