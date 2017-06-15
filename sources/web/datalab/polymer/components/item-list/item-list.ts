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
  selected: boolean,
  editing?: boolean,
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
 * Double clicking an item fires an 'ItemClickEvent' event with this
 * item's index.
 */
class ItemListElement extends Polymer.Element {

  /**
   * List of data rows, each implementing the row interface
   */
  public rows: Array<ItemListRow>;

  /**
   * List of string data columns names
   */
  public columns: Array<string>;

  /**
   * List of currently selected elements. This list keeps the actual HTML
   * elements, which can then be used to get their indices, whereas the
   * opposite is not directly possible.
   */
  public selectedElements: Array<HTMLElement>;

  static get is() { return "item-list"; }

  static get properties() {
    return {
      rows: {
        type: Array,
        value: function(): Array<Object> {
          return [{}];
        },
      },
      columns: {
        type: Array,
        value: function(): Array<string> {
          return [];
        }
      },
      selectedElements: {
        type: Array,
        value: function(): Array<Object> {
          return [];
        }
      }
    }
  }

  ready() {
    super.ready();
    this.rows = [{
      firstCol: 'hello world',
      secondCol: 'second',
      icon:'folder',
      selected: false,
      editing: false,
    }, {
      firstCol: 'hello world',
      secondCol: 'second',
      icon:'folder',
      selected: false,
      editing: false,
    }];
  }

  /**
   * Edits the currently selected item, this only works if exactly one item
   * is selected.
   * This method finds the item's element, marks it as being edited, which
   * shows the input fields, selects its contents, and hides the column title
   */
  editSelectedItem() {
    if (this.selectedElements.length === 1) {
      const element = this.selectedElements[0];
      const i = this.$.list.indexForElement(element);

      this.set('rows.' + i + '.editing', true);
      const input = element.querySelector('input');
      if (input)
        input.select();
    }
  }

  blurred() {
    debugger;
  }

  /**
   * On row click, checks the click target, if it's the checkbox, adds it to
   * the selected rows, otherwise selects it only.
   * This method also maintains the selectedElements list
   */
  _rowClicked(e: MouseEvent) {
    const target = <HTMLDivElement>e.target;
    const index = this.$.list.indexForElement(target);
    const rowElement = this._getRowElementFromChild(target);

    // If the clicked element is the checkbox, we're done, the checkbox already
    // toggles selection.
    // Otherwise, select this element, unselect all others.
    if (target.tagName !== 'PAPER-CHECKBOX') {
      for (let i = 0; i < this.rows.length; ++i) {
        this.set('rows.' + i + '.selected', false);
      }
      this.set('rows.' + index + '.selected', true);
      if (rowElement)
        this.selectedElements = [rowElement];
    } else {
      if (this.rows[index].selected === false) {
        if (rowElement) {
          const i = this.selectedElements.indexOf(rowElement);
          if (i > -1) {
            this.selectedElements.splice(i, 1);
          }
        }
      } else {
        if (rowElement)
          this.selectedElements.push(rowElement);
      }
    }
    const ev = new ItemClickEvent('itemSelectionChanged', { detail: {index: index} });
    this.dispatchEvent(ev);
  }

  /**
   * Given an element inside a row in the list, finds the parent row element
   */
  _getRowElementFromChild(childElement: HTMLElement) {
    while (childElement.tagName !== 'PAPER-ITEM' && !childElement.classList.contains('row'))
      if (childElement.parentElement)
        childElement = childElement.parentElement;
      else
        return null;
    return childElement;
  }

  /**
   * On row double click, fires an event with the clicked item's index.
   */
  _rowDoubleClicked(e: MouseEvent) {
    const index = this.$.list.indexForElement(e.target);
    const ev = new ItemClickEvent('itemDoubleClick', { detail: {index: index} });
    this.dispatchEvent(ev);
  }

}

customElements.define(ItemListElement.is, ItemListElement);

