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

/*
 * For all Polymer component testing, be sure to call Polymer's flush() after
 * any code that will cause shadow dom redistribution, such as observed array
 * mutation, wich is used by the dom-repeater in this case.
 */

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
    // has the selected attribute, and its checkbox is checked. If any of these
    // is missing then all of them should be false, otherwise we're in an
    // inconsistent state.
    if (testFixture.selectedIndices.indexOf(i) > -1
        && row.hasAttribute('selected')
        && box.checked) {
      return true;
    } else if (testFixture.selectedIndices.indexOf(i) === -1
               && !row.hasAttribute('selected')
               && !box.checked) {
      return false;
    } else {
      throw new Error('inconsistent state for row ' + i);
    }
  }

  /**
   * Returns the row element at the specified index
   * @param i index of row whose element to return
   */
  function getRow(i: number): HTMLElement {
    return testFixture.$.listContainer.querySelectorAll('paper-item')[i];
  }

  /**
   * Returns the row element at the specified index
   * @param i index of row whose element to return
   */
  function getRowDetailsContainer(i: number): HTMLElement {
    return testFixture.$.listContainer.querySelectorAll('div.row-details')[i];
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
   * Rows must be recreated on each test with the fixture, to avoid state leakage.
   */
  beforeEach(() => {
    testFixture = fixture('item-list-fixture');
    const createDetailsElement: () => HTMLElement = () => {
      const span = document.createElement('span');
      span.innerHTML = 'Mock details';
      return span;
    };
    const rows = [
      new ItemListRow({
        columns: ['first column 1', 'second column 1'],
        icon: 'folder',
      }),
      new ItemListRow({
        columns: ['first column 2', 'second column 2'],
        icon: 'folder',
      }),
      new ItemListRow({
        columns: ['first column 3', 'second column 3'],
        icon: 'folder',
      }),
      new ItemListRow({
        columns: ['first column 4', 'second column 4'],
        createDetailsElement,
        icon: 'folder',
      }),
      new ItemListRow({
        columns: ['first column 5', 'second column 5'],
        createDetailsElement,
        icon: 'folder',
      }),
    ];
    testFixture.rows = rows;
    Polymer.dom.flush();
  });

  it('displays a row per item in list', () => {
    const children = testFixture.$.listContainer.querySelectorAll('paper-item');
    assert(children.length === 5, 'five rows should appear');
  });

  it('starts out with all items unselected', () => {
    assert(JSON.stringify(testFixture.selectedIndices) === '[]', 'all items should be unselected');
  });

  it('displays column names in the header row', () => {
    testFixture.columns = ['col1', 'col2'];
    Polymer.dom.flush();

    // Column 0 is for the checkbox
    assert(testFixture.$.header.children[1].innerText === 'col1',
        'header should have first column name');
    assert(testFixture.$.header.children[2].innerText === 'col2',
        'header should have second column name');
  });

  it('displays column names in the item rows', () => {
    for (let i = 0; i < 5; ++i) {
      const row = getRow(i);
      const firstCol = row.children[1] as HTMLElement;
      const secondCol = row.children[2] as HTMLElement;
      const firstColText = 'first column ' + (i + 1);
      const secondColText = 'second column ' + (i + 1);
      assert(firstCol.innerText.trim() === firstColText, 'first column should show on item');
      assert(secondCol.innerText.trim() === secondColText, 'second column should show on item');
    }
  });

  it('selects items', () => {
    testFixture._selectItem(1);

    assert(!isSelected(0), 'first item should not be selected');
    assert(isSelected(1), 'second item should be selected');
    assert(!isSelected(2), 'third item should not be selected');
    assert(!isSelected(3), 'fourth item should not be selected');
    assert(!isSelected(4), 'fifth item should not be selected');
  });

  it('returns selected items', () => {
    testFixture._selectItem(0);
    testFixture._selectItem(2);

    assert(JSON.stringify(testFixture.selectedIndices) === '[0,2]',
        'first and third items should be selected');
  });

  it('can select/unselect all', () => {
    const c = testFixture.$.header.querySelector('#selectAllCheckbox') as HTMLElement;
    c.click();

    assert(JSON.stringify(testFixture.selectedIndices) === '[0,1,2,3,4]',
        'all items should be in the selected indices array');
    assert(isSelected(0) && isSelected(1) && isSelected(2) && isSelected(3) && isSelected(4),
        'all items should be selected');

    c.click();

    assert(JSON.stringify(testFixture.selectedIndices) === '[]',
        'no items should be in the selected indices array');
    assert(!isSelected(0) && !isSelected(1) && !isSelected(2) && !isSelected(3) && !isSelected(4),
        'all items should be unselected');
  });

  it('selects all items if the Select All checkbox is clicked with one item selected', () => {
    testFixture._selectItem(1);
    const c = testFixture.$.header.querySelector('#selectAllCheckbox') as HTMLElement;
    c.click();

    assert(JSON.stringify(testFixture.selectedIndices) === '[0,1,2,3,4]',
        'all items should be selected');
  });

  it('checks the Select All checkbox if all items are selected individually', () => {
    const c = testFixture.$.header.querySelector('#selectAllCheckbox') as any;

    assert(!c.checked, 'Select All checkbox should start out unchecked');

    testFixture._selectItem(0);
    testFixture._selectItem(1);
    testFixture._selectItem(2);
    testFixture._selectItem(3);
    testFixture._selectItem(4);

    assert(c.checked, 'Select All checkbox should become checked');
  });

  it('unchecks the Select All checkbox if one item becomes unchecked', () => {
    const c = testFixture.$.header.querySelector('#selectAllCheckbox') as any;

    testFixture._selectAll();
    assert(c.checked, 'Select All checkbox should be checked');

    testFixture._unselectItem(1);
    assert(!c.checked, 'Select All checkbox should become unchecked after unselecting an item');
  });

  it('selects the clicked item', () => {
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

    assert(!isSelected(0) && isSelected(1), 'only the second item should still be selected');
  });

  it('can do multi-selection using the checkboxes', () => {
    const firstCheckbox = getCheckbox(0);
    const thirdCheckbox = getCheckbox(2);

    firstCheckbox.click();
    assert(isSelected(0), 'first item should be selected');

    thirdCheckbox.click();
    assert(isSelected(0) && isSelected(2), 'both first and third items should be selected');
    assert(!isSelected(1) && !isSelected(3) && !isSelected(4), 'the rest should not be selected');

    firstCheckbox.click();
    assert(!isSelected(0) && !isSelected(1) && isSelected(2) && !isSelected(3) && !isSelected(4),
        'first item should be unselected after the second click');
  });

  it('can do multi-selection using the ctrl key', () => {
    const firstRow = getRow(0);
    const thirdRow = getRow(2);

    firstRow.click();
    thirdRow.dispatchEvent(new MouseEvent('click', {
      ctrlKey: true,
    }));

    assert(isSelected(0) && isSelected(2), 'both first and third items should be selected');
    assert(!isSelected(1) && !isSelected(3) && !isSelected(4), 'the rest should not be selected');

    firstRow.dispatchEvent(new MouseEvent('click', {
      ctrlKey: true,
    }));

    assert(!isSelected(0), 'first row should be unselected on ctrl click');
    assert(isSelected(2), 'third item should still be selected');
  });

  it('can do multi-selection using the shift key', () => {
    const firstRow = getRow(0);
    const thirdRow = getRow(2);

    thirdRow.click();
    firstRow.dispatchEvent(new MouseEvent('click', {
      shiftKey: true,
    }));

    assert(isSelected(0) && isSelected(1) && isSelected(2), 'items 1 to 3 should be selected');
    assert(!isSelected(3) && !isSelected(4), 'the rest should be unselected');
  });

  it('can do multi-selection with ctrl and shift key combinations', () => {
    const firstRow = getRow(0);
    const thirdRow = getRow(2);
    const fifthRow = getRow(4);

    thirdRow.click();
    firstRow.dispatchEvent(new MouseEvent('click', {
      ctrlKey: true,
    }));
    fifthRow.dispatchEvent(new MouseEvent('click', {
      shiftKey: true,
    }));

    assert(JSON.stringify(testFixture.selectedIndices) === '[0,1,2,3,4]',
        'all rows 1 to 5 should be selected');
  });

  it('hides the header when no-header property is used', () => {
    assert(testFixture.$.header.offsetHeight !== 0, 'the header row should be visible');

    testFixture.hideHeader = true;
    assert(testFixture.$.header.offsetHeight === 0, 'the header row should be hidden');
  });

  it('prevents item selection when disable-selection property is used', () => {
    testFixture.disableSelection = true;

    const firstRow = getRow(0);
    firstRow.click();

    assert(!isSelected(0), 'first item should not be selected when selection is disabled');
  });

  describe('inline details', () => {
    it('should not create a details element for an item without details', () => {
      testFixture.inlineDetailsMode = InlineDetailsDisplayMode.SINGLE_SELECT;
      const firstRow = getRow(0);
      const firstRowDetailsContainer = getRowDetailsContainer(0);
      firstRow.click();
      Polymer.dom.flush();

      assert(!firstRowDetailsContainer.firstChild,
          'first item should not show details when clicked');
    });

    it('should create a details element for an item with details', () => {
      testFixture.inlineDetailsMode = InlineDetailsDisplayMode.SINGLE_SELECT;
      const fourthRow = getRow(3);
      const fourthRowDetailsContainer = getRowDetailsContainer(3);
      fourthRow.click();
      Polymer.dom.flush();

      const detailsElement: HTMLElement =
          fourthRowDetailsContainer.firstChild as HTMLElement;
      assert(!!detailsElement,
          'fourth item should create details element when clicked');
      assert(fourthRowDetailsContainer.getAttribute('hidden') == null,
          'fourth details container should be visible');
    });

    it('should not create a details element in NONE display mode', () => {
      testFixture.inlineDetailsMode = InlineDetailsDisplayMode.NONE;
      const fourthRow = getRow(3);
      const fourthRowDetailsContainer = getRowDetailsContainer(0);
      fourthRow.click();
      Polymer.dom.flush();

      assert(!fourthRowDetailsContainer.firstChild,
          'fourth item should not create details element when clicked');
      assert(fourthRowDetailsContainer.getAttribute('hidden') != null,
          'fourth details container should not be visible');
    });

    it('should show details even when not clicked in ALL mode', () => {
      testFixture.inlineDetailsMode = InlineDetailsDisplayMode.ALL;
      // TODO: the current behavior of ALL does not show all of the details when
      // the page first renders, but only displays the details when the
      // selection state for an item changes. We might want to change this
      // behavior so that it figures out in advance that it should show
      // all the details.
      testFixture._unselectAll();   // Recalculate details display for all items
      Polymer.dom.flush();
      const fourthRowDetailsContainer = getRowDetailsContainer(3);
      const fifthRowDetailsContainer = getRowDetailsContainer(3);

      const fourthDetailsElement: HTMLElement =
          fourthRowDetailsContainer.firstChild as HTMLElement;
      assert(!!fourthDetailsElement,
          'fourth item should have details element');
      assert(fourthRowDetailsContainer.getAttribute('hidden') == null,
          'fourth details container should be visible');

      const fifthDetailsElement: HTMLElement =
          fifthRowDetailsContainer.firstChild as HTMLElement;
      assert(!!fifthDetailsElement,
          'fifth item should have details element');
      assert(fifthRowDetailsContainer.getAttribute('hidden') == null,
          'fitth details container should be visible');
    });

    it('should not show details for previously selected item ' +
        'in single-select mode', () => {
      testFixture.inlineDetailsMode = InlineDetailsDisplayMode.SINGLE_SELECT;
      const fourthRow = getRow(3);
      const fifthRow = getRow(4);
      const fourthDetailsContainer = getRowDetailsContainer(3);
      const fifthDetailsContainer = getRowDetailsContainer(4);
      fourthRow.click();
      fifthRow.click();
      Polymer.dom.flush();

      assert(fourthDetailsContainer.getAttribute('hidden') != null,
          'fourth details container should be hidden');
      assert(fifthDetailsContainer.getAttribute('hidden') == null,
          'fifth details container should be visible');
    });

    it('should not show any details when multiple items selected ' +
        'in single-select mode', () => {
      testFixture.inlineDetailsMode = InlineDetailsDisplayMode.SINGLE_SELECT;
      const fourthRow = getRow(3);
      const fifthCheckbox = getCheckbox(4);
      const fourthDetailsContainer = getRowDetailsContainer(3);
      const fifthDetailsContainer = getRowDetailsContainer(4);
      fourthRow.click();
      fifthCheckbox.click();
      Polymer.dom.flush();

      assert(fourthDetailsContainer.getAttribute('hidden') != null,
          'fourth details container should be hidden');
      assert(fifthDetailsContainer.getAttribute('hidden') != null,
          'fifth details container should be hidden');
    });

    it('should show details for multiple selected items ' +
        'in multi-select mode', () => {
      testFixture.inlineDetailsMode = InlineDetailsDisplayMode.MULTIPLE_SELECT;
      const fourthRow = getRow(3);
      const fifthCheckbox = getCheckbox(4);
      const fourthDetailsContainer = getRowDetailsContainer(3);
      const fifthDetailsContainer = getRowDetailsContainer(4);
      fourthRow.click();
      fifthCheckbox.click();
      Polymer.dom.flush();

      assert(fourthDetailsContainer.getAttribute('hidden') == null,
          'fourth details container should be visible');
      assert(fifthDetailsContainer.getAttribute('hidden') == null,
          'fifth details container should be visible');

      fifthCheckbox.click();
      Polymer.dom.flush();

      assert(fourthDetailsContainer.getAttribute('hidden') == null,
          'fourth details container should be visible');
      assert(fifthDetailsContainer.getAttribute('hidden') != null,
          'fifth details container should be hidden');
    });
  });
});
