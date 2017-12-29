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

window.addEventListener('WebComponentsReady', () => {
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
    testFixture.columns = [{
      name: 'col1',
      type: ColumnTypeName.STRING,
    }, {
      name: 'col2',
      type: ColumnTypeName.STRING,
    }];
    const rows = [
      new ItemListRow({
        columns: ['first column 1', 'second column 1'],
      }),
      new ItemListRow({
        columns: ['first column 2', 'second column 2'],
      }),
      new ItemListRow({
        columns: ['first column 3', 'second column 3'],
      }),
      new ItemListRow({
        columns: ['first column 4', 'second column 4'],
        createDetailsElement,
      }),
      new ItemListRow({
        columns: ['first column 5', 'second column 5'],
        createDetailsElement,
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
    // Column 0 is for the checkbox
    assert(testFixture.$.header.children[1].innerText.trim() === 'col1',
        'header should have first column name');
    assert(testFixture.$.header.children[2].innerText.trim() === 'col2',
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

  it('displays icons correctly', () => {
    testFixture.rows = [
      new ItemListRow({columns: [''], icon: 'folder'}),
      new ItemListRow({columns: [''], icon: 'search'}),
    ];
    const row0 = getRow(0);
    const row1 = getRow(1);
    const icon0 = row0.children[0].children[1] as any;
    const icon1 = row1.children[0].children[1] as any;
    assert(icon0.icon === 'folder');
    assert(icon1.icon === 'search');
  });

  it('selects items', () => {
    testFixture._selectItemByDisplayIndex(1);

    assert(!isSelected(0), 'first item should not be selected');
    assert(isSelected(1), 'second item should be selected');
    assert(!isSelected(2), 'third item should not be selected');
    assert(!isSelected(3), 'fourth item should not be selected');
    assert(!isSelected(4), 'fifth item should not be selected');
  });

  it('returns selected items', () => {
    testFixture._selectItemByDisplayIndex(0);
    testFixture._selectItemByDisplayIndex(2);

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
    testFixture._selectItemByDisplayIndex(1);
    const c = testFixture.$.header.querySelector('#selectAllCheckbox') as HTMLElement;
    c.click();

    assert(JSON.stringify(testFixture.selectedIndices) === '[0,1,2,3,4]',
        'all items should be selected');
  });

  it('checks the Select All checkbox if all items are selected individually', () => {
    const c = testFixture.$.header.querySelector('#selectAllCheckbox') as any;

    assert(!c.checked, 'Select All checkbox should start out unchecked');

    testFixture._selectItemByDisplayIndex(0);
    testFixture._selectItemByDisplayIndex(1);
    testFixture._selectItemByDisplayIndex(2);
    testFixture._selectItemByDisplayIndex(3);
    testFixture._selectItemByDisplayIndex(4);

    assert(c.checked, 'Select All checkbox should become checked');
  });

  it('unchecks the Select All checkbox if one item becomes unchecked', () => {
    const c = testFixture.$.header.querySelector('#selectAllCheckbox') as any;

    testFixture._selectAll();
    assert(c.checked, 'Select All checkbox should be checked');

    testFixture._unselectItemByDisplayIndex(1);
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
      testFixture._selectAll();     // Force state change for all items
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

  describe('filtering', () => {
    it('hides the filter box by default', () => {
      assert(testFixture.$.filterBox.offsetHeight === 0, 'filter box should not show by default');
    });

    it('shows/hides filter box when toggle is clicked', () => {
      testFixture.$.filterToggle.click();
      assert(testFixture.$.filterBox.offsetHeight > 0,
          'filter box should show when toggle is clicked');

      testFixture.$.filterToggle.click();
      assert(testFixture.$.filterBox.offsetHeight === 0,
          'filter box should hide when toggle is clicked again');
    });

    it('filters items when typing characters in the filter box', () => {
      testFixture.$.filterToggle.click();
      testFixture._filterString = '3';
      Polymer.dom.flush();
      const rows = testFixture.$.listContainer.querySelectorAll('.row');
      assert(rows.length === 1, 'only one item has "3" in its name');
      assert(rows[0].children[1].innerText === 'first column 3',
          'filter should only return the third item');
    });

    it('shows all items when filter string is deleted', () => {
      testFixture.$.filterToggle.click();
      testFixture._filterString = '3';
      Polymer.dom.flush();
      testFixture._filterString = '';
      Polymer.dom.flush();
      const rows = testFixture.$.listContainer.querySelectorAll('.row');
      assert(rows.length === 5, 'should show all rows after filter string is deleted');
    });

    it('filters items based on first column only', () => {
      testFixture.$.filterToggle.click();
      testFixture._filterString = 'second';
      Polymer.dom.flush();
      const rows = testFixture.$.listContainer.querySelectorAll('.row');
      assert(rows.length === 0,
          'should not show any rows, since no row has "second" in its first column');
    });

    it('ignores case when filtering', () => {
      testFixture.$.filterToggle.click();
      testFixture._filterString = 'COLUMN 4';
      Polymer.dom.flush();
      const rows = testFixture.$.listContainer.querySelectorAll('.row');
      assert(rows.length === 1,
          'should show one row containing "column 4", since filtering is case insensitive');
      assert(rows[0].children[1].innerText === 'first column 4',
          'filter should return the fourth item');
    });

    it('resets filter when filter box is closed', () => {
      testFixture.$.filterToggle.click();
      testFixture._filterString = '3';
      Polymer.dom.flush();
      testFixture.$.filterToggle.click();
      Polymer.dom.flush();
      assert(testFixture.$.listContainer.querySelectorAll('.row').length === 5,
          'all rows should show after closing filter box');
    });

    it('selects only visible items when Select All checkbox is clicked', () => {
      testFixture.$.filterToggle.click();
      testFixture._filterString = '3';
      Polymer.dom.flush();
      testFixture.$.selectAllCheckbox.click();

      testFixture._filterString = '';
      Polymer.dom.flush();

      assert(!isSelected(0), 'only third item should be selected');
      assert(!isSelected(1), 'only third item should be selected');
      assert(isSelected(2), 'only third item should be selected');
      assert(!isSelected(3), 'only third item should be selected');
      assert(!isSelected(4), 'only third item should be selected');
    });

    it('returns the correct selectedIndices result matching clicked items when filtering', () => {
      testFixture.$.filterToggle.click();
      testFixture._filterString = '2';
      Polymer.dom.flush();

      const firstRow = getRow(0);
      firstRow.click();
      const selectedIndices = testFixture.selectedIndices;
      assert(selectedIndices.length === 1, 'only one item should be selected');
      assert(selectedIndices[0] === 1, 'the second index (only one shown) should be selected');
    });
  });

  describe('sorting', () => {
    const rows = [
      new ItemListRow({columns: ['item c*', new Date('Sat Nov 11 2017 18:58:42 GMT+0200 (EET)')]}),
      new ItemListRow({columns: ['item a*', new Date('Sat Nov 11 2017 18:59:42 GMT+0200 (EET)')]}),
      new ItemListRow({columns: ['item b', new Date('Fri Nov 10 2017 18:57:42 GMT+0200 (EET)')]})
    ];

    const col0SortedOrder = [1, 2, 0];
    const col1SortedOrder = [2, 0, 1];
    const col0ReverseOrder = col0SortedOrder.slice().reverse();

    beforeEach(async () => {
      testFixture = fixture('item-list-fixture');
      testFixture.rows = rows;
      testFixture.columns = [{
        name: 'col1',
        type: ColumnTypeName.STRING,
      }, {
        name: 'col2',
        type: ColumnTypeName.DATE,
      }];
      testFixture.$.list.render();
    });

    it('sorts on first column by default', () => {
      const renderedRows = testFixture.$.listContainer.querySelectorAll('.row');
      for (let i = 0; i < testFixture.rows.length; ++i) {
        const columns = renderedRows[i].querySelectorAll('.column');
        const sortedColumns = testFixture.rows[col0SortedOrder[i]].columns;
        assert(columns[0].innerText === sortedColumns[0]);
        assert(columns[1].innerText === new Date(sortedColumns[1].toString()).toLocaleString());
      }
    });

    it('switches sort to descending order if first column is sorted on again', () => {
      const renderedRows = testFixture.$.listContainer.querySelectorAll('.row');
      testFixture._sortBy(0);
      testFixture.$.list.render();
      for (let i = 0; i < testFixture.rows.length; ++i) {
        const columns = renderedRows[i].querySelectorAll('.column');
        const sortedColumns = testFixture.rows[col0ReverseOrder[i]].columns;
        assert(columns[0].innerText === sortedColumns[0]);
        assert(columns[1].innerText === new Date(sortedColumns[1].toString()).toLocaleString());
      }
    });

    it('when switching to sorting on second column, uses ascending order', () => {
      testFixture._sortBy(1);
      testFixture.$.list.render();
      const renderedRows = testFixture.$.listContainer.querySelectorAll('.row');
      for (let i = 0; i < testFixture.rows.length; ++i) {
        const columns = renderedRows[i].querySelectorAll('.column');
        const sortedColumns = testFixture.rows[col1SortedOrder[i]].columns;
        assert(columns[0].innerText === sortedColumns[0]);
        assert(columns[1].innerText === new Date(sortedColumns[1].toString()).toLocaleString());
      }
    });

    it('shows arrow icon on the sorted column', () => {
      const headerIcons = testFixture.$.header.querySelectorAll('.sort-icon');
      assert(!headerIcons[0].hidden, 'first column should show sort icon');
      assert(headerIcons[0].icon === 'arrow-upward',
          'first column should show ascending sort icon');
      assert(headerIcons[1].hidden, 'second column icon should be hidden');

      testFixture._sortBy(1);
      testFixture.$.list.render();
      assert(headerIcons[0].hidden, 'first column icon should be hidden');
      assert(!headerIcons[1].hidden, 'second column should show sort icon');
      assert(headerIcons[1].icon === 'arrow-upward',
          'second column should show ascending sort icon');

      testFixture._sortBy(1);
      testFixture.$.list.render();
      assert(headerIcons[0].hidden, 'first column icon should be hidden');
      assert(!headerIcons[1].hidden, 'second column should show sort icon');
      assert(headerIcons[1].icon === 'arrow-downward',
          'second column should show descending sort icon');
    });

    it('sorts the clicked column', () => {
      const headerButtons = testFixture.$.header.querySelectorAll('.column-button');
      const headerIcons = testFixture.$.header.querySelectorAll('.sort-icon');
      headerButtons[0].click();
      testFixture.$.list.render();
      assert(headerIcons[0].icon === 'arrow-downward',
          'first column should show descending sort icon');

      headerButtons[1].click();
      testFixture.$.list.render();
      assert(headerIcons[1].icon === 'arrow-upward',
          'second column should show ascending sort icon');
    });

    it('sorts while filtering is active', () => {
      testFixture.$.filterToggle.click();
      testFixture._filterString = '*';
      testFixture.$.list.render();

      let renderedRows = testFixture.$.listContainer.querySelectorAll('.row');
      // row 0
      let columns0 = renderedRows[0].querySelectorAll('.column');
      assert(columns0[0].innerText === testFixture.rows[1].columns[0]);
      assert(columns0[1].innerText ===
          new Date(testFixture.rows[1].columns[1].toString()).toLocaleString());
      // row 1
      let columns1 = renderedRows[1].querySelectorAll('.column');
      assert(columns1[0].innerText === testFixture.rows[0].columns[0]);
      assert(columns1[1].innerText ===
          new Date(testFixture.rows[0].columns[1].toString()).toLocaleString());

      testFixture._sortBy(0);
      testFixture.$.list.render();
      renderedRows = testFixture.$.listContainer.querySelectorAll('.row');
      // row 0
      columns0 = renderedRows[0].querySelectorAll('.column');
      assert(columns0[0].innerText === testFixture.rows[0].columns[0]);
      assert(columns0[1].innerText ===
          new Date(testFixture.rows[0].columns[1].toString()).toLocaleString());
      // row 1
      columns1 = renderedRows[1].querySelectorAll('.column');
      assert(columns1[0].innerText === testFixture.rows[1].columns[0]);
      assert(columns1[1].innerText ===
          new Date(testFixture.rows[1].columns[1].toString()).toLocaleString());
    });

    it('sorts numbers correctly', () => {
      testFixture.columns = [{
        name: 'col1',
        type: ColumnTypeName.NUMBER,
      }];
      testFixture.rows = [
        new ItemListRow({columns: [11]}),
        new ItemListRow({columns: [1]}),
        new ItemListRow({columns: [2]}),
      ];
      const sortedOrder = [1, 2, 0];

      const renderedRows = testFixture.$.listContainer.querySelectorAll('.row');
      for (let i = 0; i < testFixture.rows.length; ++i) {
        const columns = renderedRows[i].querySelectorAll('.column');
        assert(columns[0].innerText === testFixture.rows[sortedOrder[i]].columns[0].toString());
      }
    });

    it('sorts correctly when there are equal values', () => {
      testFixture.columns = [{
        name: 'col1',
        type: ColumnTypeName.NUMBER,
      }];
      testFixture.rows = [
        new ItemListRow({columns: [2]}),
        new ItemListRow({columns: [1]}),
        new ItemListRow({columns: [2]}),
        new ItemListRow({columns: [1]}),
        new ItemListRow({columns: [11]}),
        new ItemListRow({columns: [2]}),
      ];
      const sortedOrder = [1, 3, 0, 2, 5, 4];

      const renderedRows = testFixture.$.listContainer.querySelectorAll('.row');
      for (let i = 0; i < testFixture.rows.length; ++i) {
        const columns = renderedRows[i].querySelectorAll('.column');
        assert(columns[0].innerText === testFixture.rows[sortedOrder[i]].columns[0].toString());
      }
    });

    it('returns the correct selectedIndices result matching clicked items when sorted', () => {
      testFixture.columns = [{
        name: 'col1',
        type: ColumnTypeName.NUMBER,
      }];
      testFixture.rows = [
        new ItemListRow({columns: [1]}),
        new ItemListRow({columns: [2]}),
        new ItemListRow({columns: [3]}),
      ];
      // Reverse the sorting
      testFixture._sortBy(0);

      const firstRow = getRow(0);
      firstRow.click();
      const selectedIndices = testFixture.selectedIndices;
      assert(selectedIndices.length === 1, 'only one item should be selected');
      assert(selectedIndices[0] === 2, 'the third index (shown first) should be selected');
    });
  });
});
});
