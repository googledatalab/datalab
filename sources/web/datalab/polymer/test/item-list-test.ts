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

declare function assert(condition: boolean, message?: string): null;
declare function fixture(element: string): any;

/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />
/// <reference path="../components/item-list/item-list.ts" />

describe('<item-list>', () => {
  let testFixture: ItemListElement;

  /**
   * Returns true iff the item at the specified index is checked
   * @param i index of item to check
   */
  function isSelected(i: number): boolean {
    const row = getRow(i);
    const box = getCheckbox(i);
    // Check three things: the index is in the selectedIndices array, the row
    // has the selected attribute, and its checkbox is checked
    return testFixture.selectedIndices.indexOf(i) > -1
        && row.hasAttribute('selected')
        && box.checked;
  }

  /**
   * Returns the row element at the specified index
   * @param i index of row whose element to return
   */
  function getRow(i: number): HTMLElement {
    return testFixture.$.listContainer.querySelectorAll('paper-item')[i];
  }

  /**
   * Returns the checkbox element at the specified index
   * @param i index of row whose checkbox element to return
   */
  function getCheckbox(i: number): any {
    const row = getRow(i);
    return row.querySelector('paper-checkbox');
  }

  /**
   * Rows must be recreated on each test with the fixture, to avoid state
   * leakage. Also be sure to call Polymer's flush() after any code that will
   * cause shadow dom redistribution, such as observed array mutation, wich is
   * used by the dom-repeater in this case.
   */
  beforeEach(() => {
    testFixture = fixture('item-list-fixture');
    const rows: ItemListRow[] = [
      {
        firstCol: 'first column 1',
        icon: 'folder',
        secondCol: 'second column 1',
        selected: false,
      },
      {
        firstCol: 'first column 2',
        icon: 'folder',
        secondCol: 'second column 2',
        selected: false,
      },
      {
        firstCol: 'first column 3',
        icon: 'folder',
        secondCol: 'second column 3',
        selected: false,
      }
    ];
    testFixture.rows = rows;
    Polymer.dom.flush();
  });

  it('displays a row per item in list', () => {
    const children = testFixture.$.listContainer.querySelectorAll('paper-item');
    assert(children.length === 3, 'three rows should appear');
  });

  it('displays column names in the header row', () => {
    testFixture.columns = ['col1', 'col2'];
    Polymer.dom.flush();

    // Column 0 is for the checkbox
    assert(testFixture.$.header.children[1].innerText === 'col1');
    assert(testFixture.$.header.children[2].innerText === 'col2');
  });

  it('selected items are selected', () => {
    testFixture._selectItem(1);

    assert(!isSelected(0), 'first item should not be selected');
    assert(isSelected(1), 'second item should be selected');
    assert(!isSelected(2), 'third item should not be selected');
  });

  it('selected items are returned', () => {
    testFixture._selectItem(0);
    testFixture._selectItem(2);

    assert(JSON.stringify(testFixture.selectedIndices) === '[0,2]',
        'first and third items should be selected');
  });

  it('can select/unselect all', () => {
    const c = testFixture.$.header.querySelector('#selectAllCheckbox') as HTMLElement;
    c.click();

    assert(JSON.stringify(testFixture.selectedIndices) === '[0,1,2]');
    assert(isSelected(0) && isSelected(1) && isSelected(2), 'all items should be selected');

    c.click();

    assert(JSON.stringify(testFixture.selectedIndices) === '[]');
    assert(!isSelected(0) && !isSelected(1) && !isSelected(2), 'all items should be unselected');
  });

  it('clicking an item always selects it', () => {
    const firstRow = getRow(0);
    firstRow.click();

    assert(isSelected(0), 'first item should be selected');

    firstRow.click();

    assert(isSelected(0), 'first item should still be selected');
  });

  it('selects only the clicked item if the checkbox was not clicked', () => {
    const firstRow = getRow(0);
    const secondRow = getRow(1);

    firstRow.click();
    secondRow.click();

    assert(isSelected(1), 'only the second item should still be selected');
  });

  it('can do multi-selection using the checkboxes', () => {
    const firstCheckbox = getCheckbox(0);
    const thirdCheckbox = getCheckbox(2);

    firstCheckbox.click();
    assert(isSelected(0), 'first item should be selected');

    thirdCheckbox.click();
    assert(isSelected(0) && isSelected(2), 'both first and third items should be selected');
    assert(!isSelected(1), 'second item should not be selected');
  });

  it('can do multi-selection using the ctrl key', () => {
    const firstRow = getRow(0);
    const thirdRow = getRow(2);

    firstRow.click();
    thirdRow.dispatchEvent(new MouseEvent('click', {
      ctrlKey: true,
    }));

    assert(isSelected(0) && isSelected(2), 'both first and third items should be selected');
    assert(!isSelected(1), 'second item should not be selected');

    firstRow.dispatchEvent(new MouseEvent('click', {
      ctrlKey: true,
    }));

    assert(!isSelected(0), 'first row should be unselected on ctrl click');
  });

  it('can do multi-selection using the shift key', () => {
    const firstRow = getRow(0);
    const thirdRow = getRow(2);

    thirdRow.click();
    firstRow.dispatchEvent(new MouseEvent('click', {
      shiftKey: true,
    }));

    assert(isSelected(0) && isSelected(1) && isSelected(2), 'all items should be selected');
  });

  it('hides the header when no-header property is used', () => {
    assert(testFixture.$.header.offsetHeight !== 0);

    testFixture.hideHeader = true;
    assert(testFixture.$.header.offsetHeight === 0);
  });

  it('prevents item selection when disable-selection property is used', () => {
    testFixture.disableSelection = true;

    const firstRow = getRow(0);
    firstRow.click();

    assert(!isSelected(0), 'first item should not be selected when selection is disabled');
  });

});
