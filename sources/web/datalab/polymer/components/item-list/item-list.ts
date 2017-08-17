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
  firstCol: string;
  secondCol: string;
  icon: string;
  selected: boolean;
}

/**
 * CustomEvent that gets dispatched when an item is clicked or double clicked
 */
class ItemClickEvent extends CustomEvent {
  detail: {
    index: number;
  };
}

/**
 * Two-column list element.
 * This element takes a list of two column names, and a list of row objects,
 * each containing values for each of the columns, an icon name, and a selected
 * property. The items are displayed in a table form. Clicking an item selects
 * it and unselects all other items. Clicking the checkbox next to an item
 * allows for multi-selection. Shift and ctrl keys can also be used to select
 * multiple items.
 * Double clicking an item fires an 'ItemClickEvent' event with this item's index.
 * Selecting an item by single clicking it changes the selectedIndices
 * property. This also notifies the host, which can listen to the
 * selected-indices-changed event.
 * If the "hide-header" attribute is specified, the header is hidden.
 * If the "disable-selection" attribute is specified, the checkboxes are
 * hidden, and clicking items does not select them.
 */
class ItemListElement extends Polymer.Element {

  /**
   * List of data rows, each implementing the row interface
   */
  public rows: ItemListRow[];

  /**
   * List of string data columns names
   */
  public columns: string[];

  /**
   * Whether to hide the header row
   */
  public hideHeader: boolean;

  /**
   * Whether to disable item selection
   */
  public disableSelection: boolean;

  /**
   * The list of currently selected indices
   */
  public selectedIndices: number[];

  private _lastSelectedIndex = -1;

  static get is() { return 'item-list'; }

  static get properties() {
    return {
      _isAllSelected: {
        computed: '_computeIsAllSelected(selectedIndices)',
        type: Boolean,
      },
      columns: {
        type: Array,
        value: () => [],
      },
      disableSelection: {
        type: Boolean,
        value: false,
      },
      hideHeader: {
        type: Boolean,
        value: false,
      },
      rows: {
        type: Array,
        value: () => [],
      },
      selectedIndices: {
        computed: '_computeSelectedIndices(rows.*)',
        notify: true,
        type: Array,
        value: () => [],
      },
    };
  }

  /**
   * Returns value for the computed property selectedIndices, which is the list
   * of indices of the currently selected items.
   */
  _computeSelectedIndices() {
    const selected: number[] = [];
    this.rows.forEach((row, i) => {
      if (row.selected) {
        selected.push(i);
      }
    });
    return selected;
  }

  /**
   * Returns the value for the computed property isAllSelected, which is whether
   * all items in the list are selected.
   */
  _computeIsAllSelected() {
    return this.rows.length > 0 && this.rows.length === this.selectedIndices.length;
  }

  /**
   * Selects an item in the list.
   * @param index index of item to select
   */
  _selectItem(index: number) {
    this.set('rows.' + index + '.selected', true);
  }

  /**
   * Unselects an item in the list.
   * @param index index of item to unselect
   */
  _unselectItem(index: number) {
    this.set('rows.' + index + '.selected', false);
  }

  /**
   * Selects all items in the list.
   */
  _selectAll() {
    this.rows.forEach((_, i) => {
      this._selectItem(i);
    });
  }

  /**
   * Unselects all items in the list.
   */
  _unselectAll() {
    this.rows.forEach((_, i) => {
      this._unselectItem(i);
    });
  }

  /**
   * Called when the select/unselect all checkbox checked value is changed.
   */
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
   */
  _rowClicked(e: MouseEvent) {
    if (this.disableSelection) {
      return;
    }
    const target = e.target as HTMLDivElement;
    const index = this.$.list.indexForElement(target);

    // If shift key is pressed and we had saved the last selected index, select
    // all items from this index till the last selected.
    if (e.shiftKey && this._lastSelectedIndex !== -1 && this.selectedIndices.length > 0) {
      this._unselectAll();
      const start = Math.min(this._lastSelectedIndex, index);
      const end = Math.max(this._lastSelectedIndex, index);
      for (let i = start; i <= end; ++i) {
        this._selectItem(i);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // If ctrl (or Meta for MacOS) key is pressed, toggle its selection.

      if (this.rows[index].selected === false) {
        this._selectItem(index);
      } else {
        this._unselectItem(index);
      }
    } else {
      // No modifier keys are pressed, proceed normally to select/unselect the item.

      // If the clicked element is the checkbox, the checkbox already toggles selection in
      // the UI, so change the item's selection state to match the checkbox's new value.
      // Otherwise, select this element, unselect all others.
      if (target.tagName === 'PAPER-CHECKBOX') {
        if (this.rows[index].selected === false) {
          // Remove this element from the selected elements list if it's being unselected
          this._unselectItem(index);
        } else {
          // Add this element to the selected elements list if it's being selected,
          this._selectItem(index);
        }
      } else {
        this._unselectAll();
        this._selectItem(index);
      }
    }

    // Save this index to enable multi-selection using shift later.
    this._lastSelectedIndex = index;
  }

  /**
   * On row double click, fires an event with the clicked item's index.
   */
  _rowDoubleClicked(e: MouseEvent) {
    const index = this.$.list.indexForElement(e.target);
    const ev = new ItemClickEvent('itemDoubleClick', { detail: {index} });
    this.dispatchEvent(ev);
  }

}

customElements.define(ItemListElement.is, ItemListElement);
