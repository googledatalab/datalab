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

/// <reference path="../input-dialog/input-dialog.ts" />
/// <reference path="../item-list/item-list.ts" />

interface Collection {
  name : string;
  status : string;
  tables? : Array<Table>;
}

interface Table {
  name : string;
  status : string;
}

/**
 * Data element for Datalab.
 * Contains a form for initial user input, and a list of tables.
 */
class DataElement extends Polymer.Element {

  /** The value the user can enter to filter the collections. */
  public collectionsFilterValue : string;

  /** The value the user can enter to filter the tables. */
  public tablesFilterValue : string;

  private _collectionsList : Array<Collection>;
  private _tablesList : Array<Table>;

  static get is() { return "datalab-data"; }

  static get properties() {
    return {
      collectionsFilterValue: {
        type: String,
        value: 'no-filter',
      },
      tablesFilterValue: {
        type: String,
        value: 'no-filter',
      },
      _collectionsList: {
        type: Array,
        value: () => [],
        observer: '_renderCollectionsList',
      },
      _tablesList: {
        type: Array,
        value: () => [],
        observer: '_renderTablesList',
      },
    };
  }

  ready() {
    super.ready();

    this._collectionsList = [];
    const collectionsElement = <ItemListElement>this.$.collections;
    if (collectionsElement) {
      collectionsElement.addEventListener('itemDoubleClick',
                                    this._collectionsDoubleClicked.bind(this));
      collectionsElement.addEventListener('selected-indices-changed',
                                    this._collectionsSelectionChanged.bind(this));
    }

    this._tablesList = [];
    const tablesElement = <ItemListElement>this.$.tables;
    if (tablesElement) {
      tablesElement.addEventListener('itemDoubleClick',
                                    this._tablesDoubleClicked.bind(this));
      tablesElement.addEventListener('selected-indices-changed',
                                    this._tablesSelectionChanged.bind(this));
    }
  }

  _generateFakeCollectionsListForTesting() {
    const collectionsList = [];
    const count = Math.floor(Math.random() * 20);
    for (let i=0; i < count; i++) {
      collectionsList.push(this._generateFakeCollectionForTesting());
    }
    return collectionsList;
  }

  _generateFakeCollectionForTesting() {
    const fakeCollection = {
      name: 'fakeCollection' + Math.floor(Math.random() * 1000000),
      status: 'fake',
    };
    return fakeCollection;
  }

  _generateFakeTablesListForTesting() {
    const tablesList = [];
    const count = Math.floor(Math.random() * 20);
    for (let i=0; i < count; i++) {
      tablesList.push(this._generateFakeTableForTesting());
    }
    return tablesList;
  }

  _generateFakeTableForTesting() {
    const fakeTable = {
      name: 'fakeTable' + Math.floor(Math.random() * 1000000),
      status: 'fake',
    };
    return fakeTable;
  }

  /** Reads the user's query values, queries for tables, and updates the results. */
  _search() {
    this._collectionsList = this._generateFakeCollectionsListForTesting();
  }

  /**
   * Creates a new ItemListRow object for each entry in the collections list, and sends
   * the created list to the item-list to render.
   */
  _renderCollectionsList() {
    this.$.collections.rows = this._collectionsList.map(collection => {
      return {
        firstCol: collection.name,
        secondCol: collection.status,
        icon: 'folder',
        selected: false
      };
    });
  }

  _showTablesForCollection(collection: Collection) {
    console.log('== collection selected:', collection);
    if (!collection.tables) {
      collection.tables = this._generateFakeTablesListForTesting();
    }
    this._tablesList = collection.tables;
  }

  _clearTablesList() {
    this._tablesList = [];
  }

  _showDetailsForTable(table: Table) {
    this.$.detailsPane.innerHTML = 'Selected table: ' + table.name;
  }

  _clearTableDetails() {
    this.$.detailsPane.innerHTML = '';
  }

  /**
   * Creates a new ItemListRow object for each entry in the collections list, and sends
   * the created list to the item-list to render.
   */
  _renderTablesList() {
    this.$.tables.rows = this._tablesList.map(table => {
      return {
        firstCol: table.name,
        secondCol: table.status,
        icon: 'file',
        selected: false
      };
    });
  }

  _collectionsDoubleClicked() {
    console.log('== collection double-clicked');
  }

  _collectionsSelectionChanged() {
    console.log('== collection selection changed');
      const selectedIndices = (<ItemListElement>this.$.collections).selectedIndices;
    if (selectedIndices.length == 1) {
      this._showTablesForCollection(this._collectionsList[selectedIndices[0]]);
    } else {
      this._clearTablesList();
    }
  }

  _tablesDoubleClicked() {
    console.log('== table double-clicked');
  }

  _tablesSelectionChanged() {
    console.log('== table selection changed');
    const selectedIndices = (<ItemListElement>this.$.tables).selectedIndices;
    if (selectedIndices.length == 1) {
      this._showDetailsForTable(this._tablesList[selectedIndices[0]]);
    } else {
      this._clearTableDetails();
    }
  }
}

customElements.define(DataElement.is, DataElement);
