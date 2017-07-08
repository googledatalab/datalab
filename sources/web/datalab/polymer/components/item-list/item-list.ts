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
 * item's index. Similarly, selection fires an 'ItemClickEvent' with
 * the most recent clicked item's index.
 * If the "hide-header" attribute is specified, the header is hidden.
 * If the "disable-selection" attribute is specified, the checkboxes are
 * hidden, and clicking items does not select them.
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
   * Whether to hide the header row
   */
  public hideHeader: boolean;

  /**
   * Whether to disable item selection
   */
  public disableSelection: boolean;

  private selectedElements: Array<HTMLElement>;
  private _lastSelectedIndex: number;
  private _isAllSelected: boolean;

  static get is() { return "item-list"; }

  static get properties() {
    return {
      rows: {
        type: Array,
        value: () => [],
        observer: '_rowsChanged',
      },
      columns: {
        type: Array,
        value: () => [],
      },
      hideHeader: {
        type: Boolean,
        value: false,
      },
      disableSelection: {
        type: Boolean,
        value: false,
      },
      selectedElements: {
        type: Array,
        value: () => [],
        notify: true,
      },
      _isAllSelected: {
        type: Boolean,
        value: false,
      },
    }
  }

  /**
   * Returns list of currently selected elements. This list keeps the actual
   * HTML elements, which can then be used to get their indices, whereas the
   * opposite is not directly possible.
   */
  getSelectedElements() {
    return this.disableSelection ? [] : this.selectedElements;
  }

  /**
   * Returns list of indices for the currently selected elements.
   */
  getSelectedIndices() {
    return this.disableSelection ? [] : this.selectedElements.map(element => {
      return this.$.list.indexForElement(element);
    });
  }

  /**
   * Clears the list of selected elements. No items should be selected when the
   * list of rows is refreshed.
   */
  _rowsChanged() {
    this.selectedElements = [];
    this._lastSelectedIndex = -1;
  }

  _selectItem(index: number) {
    const element = this.$.listContainer.children[index];
    const i = this.selectedElements.indexOf(element);
    if (i === -1) {
      this.push('selectedElements', element);
    }
    this.set('rows.' + index + '.selected', true);
    this._isAllSelected = this.selectedElements.length === this.rows.length;
  }

  _unselectItem(index: number) {
    const element = this.$.listContainer.children[index];
    const i = this.selectedElements.indexOf(element);
    if (i > -1) {
      this.splice('selectedElements', i, 1);
    }
    this.set('rows.' + index+ '.selected', false);
    this._isAllSelected = this.selectedElements.length === this.rows.length;
  }

  _selectAll() {
    for (let i = 0; i < this.rows.length; ++i) {
      this._selectItem(i);
    }
  }

  _unselectAll() {
    for (let i = 0; i < this.rows.length; ++i) {
      this._unselectItem(i);
    }
  }

  _selectAllChanged() {
    if (this.$.selectAllCheckbox.checked === true) {
      this._selectAll();
    } else {
      this._unselectAll();
    }
  }

  /**
   * On row click, checks the click target, if it's the checkbox, adds it to
   * the selected rows, otherwise selects it only.
   * This method also maintains the selectedElements list.
   */
  _rowClicked(e: MouseEvent) {
    if (this.disableSelection) {
      return;
    }
    const target = <HTMLDivElement>e.target;
    const index = this.$.list.indexForElement(target);

    // If shift key is pressed and we had saved the last selected index, select
    // all items from this index till the last selected.
    if (e.shiftKey && this._lastSelectedIndex !== -1) {
      this._unselectAll();
      const start = Math.min(this._lastSelectedIndex, index);
      const end = Math.max(this._lastSelectedIndex, index);
      for (let i = start; i <= end; ++i) {
        this._selectItem(i);
      }
    } else if (e.ctrlKey) {
      // If ctrl key is pressed, toggle its selection.
      if (this.rows[index].selected === false) {
        this._selectItem(index);
      } else {
        this._unselectItem(index);
      }
    } else {
      // If the clicked element is the checkbox, we're done, the checkbox already
      // toggles selection.
      // Otherwise, select this element, unselect all others.
      if (target.tagName !== 'PAPER-CHECKBOX') {
        this._unselectAll();
        this._selectItem(index);
      } else {
        if (this.rows[index].selected === false) {
          // Remove this element from the selected elements list if it's being unselected
          this._unselectItem(index);
        } else {
          // Add this element to the selected elements list if it's being selected,
          this._selectItem(index);
        }
      }
    }

    this._lastSelectedIndex = index;
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
