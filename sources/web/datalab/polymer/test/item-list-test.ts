declare function flush(fn?: () => any): null;
declare function assert(condition: boolean, message?: string): null;
declare function fixture(element: string): any;

/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />
/// <reference path="../components/item-list/item-list.ts" />

describe('<item-list>', () => {
  let testFixture: ItemListElement;

  function isSelected(i: number) {
    const row = getRow(i);
    const box = getCheckbox(i);
    // Check three things: the index is in the selectedIndices array, the row
    // has the selected attribute, and its checkbox is checked
    return testFixture.selectedIndices.indexOf(i) > -1
        && row.hasAttribute('selected')
        && box.checked;
  }

  function getRow(i: number) {
    return testFixture.$.listContainer.querySelectorAll('paper-item')[i];
  }

  function getCheckbox(i: number) {
    const row = getRow(i);
    return row.querySelector('paper-checkbox');
  }

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
    flush();
  });

  it('displays a row per item in list', () => {
    const children = testFixture.$.listContainer.querySelectorAll('paper-item');
    assert(children.length === 3, 'three rows should appear');
  });

  it('selected items are selected', () => {
    testFixture._selectItem(1);
    flush();

    assert(!isSelected(0), 'first item should not be selected');
    assert(isSelected(1), 'second item should be selected');
    assert(!isSelected(2), 'third item should not be selected');
  });

  it('selected items are returned', () => {
    testFixture._selectItem(0);
    testFixture._selectItem(2);
    flush();

    assert(JSON.stringify(testFixture.selectedIndices) === '[0,2]',
        'first and third items should be selected');
  });

  it('can select/unselect all', () => {
    const c = testFixture.$.header.querySelector('#selectAllCheckbox') as HTMLElement;
    c.click();
    flush();

    assert(JSON.stringify(testFixture.selectedIndices) === '[0,1,2]');
    assert(isSelected(0), 'all items should be selected');
    assert(isSelected(1), 'all items should be selected');
    assert(isSelected(2), 'all items should be selected');

    c.click();
    flush();

    assert(JSON.stringify(testFixture.selectedIndices) === '[]');
    assert(!isSelected(0), 'all items should be unselected');
    assert(!isSelected(1), 'all items should be unselected');
    assert(!isSelected(2), 'all items should be unselected');
  });

  it('clicking an item always selects it', () => {
    const firstRow = getRow(0);
    firstRow.click();
    flush();

    assert(isSelected(0), 'first item should be selected');

    firstRow.click();
    flush();

    assert(isSelected(0), 'first item should still be selected');
  });

  it('selects only the clicked item if the checkbox was not clicked', () => {
    const firstRow = getRow(0);
    const secondRow = getRow(1);

    firstRow.click();
    secondRow.click();
    flush();

    assert(isSelected(1), 'only the second item should still be selected');
  });

  it('can do multi-selection using the checkboxes', () => {
    const firstCheckbox = getCheckbox(0);
    const secondCheckbox = getCheckbox(1);

    firstCheckbox.click();
    flush();
    assert(isSelected(0), 'first item should be selected');

    secondCheckbox.click();
    flush();
    assert(isSelected(0) && isSelected(1), 'both first and second items should be selected');
  });
});
