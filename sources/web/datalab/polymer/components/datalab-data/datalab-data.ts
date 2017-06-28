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
  datasets? : Array<Dataset>;
}

interface Dataset {
  name : string;
  status : string;
}

/**
 * Data element for Datalab.
 * Contains a form for initial user input, and a list of datasets.
 */
class DataElement extends Polymer.Element {

  public projectValue : string;
  public collectionsFilterValue : string;
  public datasetsFilterValue : string;

  private _collectionsList : Array<Collection>;
  private _datasetsList : Array<Dataset>;

  static get is() { return "datalab-data"; }

  static get properties() {
    return {
      projectValue: {
        type: String,
        value: 'fake-project',
      },
      collectionsFilterValue: {
        type: String,
        value: 'no-filter',
      },
      datasetsFilterValue: {
        type: String,
        value: 'no-filter',
      },
    };
  }

  ready() {
    super.ready();

    this._collectionsList = [];
    const collectionsElement = this.shadowRoot.querySelector('#collections')
    if (collectionsElement) {
      collectionsElement.addEventListener('itemDoubleClick',
                                    this._collectionsDoubleClicked.bind(this));
      collectionsElement.addEventListener('selected-indices-changed',
                                    this._collectionsSelectionChanged.bind(this));
    }

    this._datasetsList = [];
    const datasetsElement = this.shadowRoot.querySelector('#datasets')
    if (datasetsElement) {
      datasetsElement.addEventListener('itemDoubleClick',
                                    this._datasetsDoubleClicked.bind(this));
      datasetsElement.addEventListener('selected-indices-changed',
                                    this._datasetsSelectionChanged.bind(this));
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

  _generateFakeDatasetsListForTesting() {
    const datasetsList = [];
    const count = Math.floor(Math.random() * 20);
    for (let i=0; i < count; i++) {
      datasetsList.push(this._generateFakeDatasetForTesting());
    }
    return datasetsList;
  }

  _generateFakeDatasetForTesting() {
    const fakeDataset = {
      name: 'fakeDataset' + Math.floor(Math.random() * 1000000),
      status: 'fake',
    };
    return fakeDataset;
  }

  /** Reads the user's query values, queries for datasets, and updates the results. */
  _search() {
    this._collectionsList = this._generateFakeCollectionsListForTesting();
    this._renderCollectionsList();
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

  _showDatasetsForCollection(collection: Collection) {
    console.log('== collection selected:', collection);
    if (!collection.datasets) {
      collection.datasets = this._generateFakeDatasetsListForTesting();
    }
    this._datasetsList = collection.datasets;
    this._renderDatasetsList();
  }

  _clearDatasetsList() {
    this._datasetsList = [];
    this._renderDatasetsList();
  }

  _showDetailsForDataset(dataset: Dataset) {
    this.$.detailsPane.innerHTML = 'Selected dataset: ' + dataset.name;
  }

  _clearDatasetDetails() {
    this.$.detailsPane.innerHTML = '';
  }

  /**
   * Creates a new ItemListRow object for each entry in the collections list, and sends
   * the created list to the item-list to render.
   */
  _renderDatasetsList() {
    this.$.datasets.rows = this._datasetsList.map(dataset => {
      return {
        firstCol: dataset.name,
        secondCol: dataset.status,
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
      this._showDatasetsForCollection(this._collectionsList[selectedIndices[0]]);
    } else {
      this._clearDatasetsList();
    }
  }

  _datasetsDoubleClicked() {
    console.log('== dataset double-clicked');
  }

  _datasetsSelectionChanged() {
    console.log('== dataset selection changed');
    const selectedIndices = (<ItemListElement>this.$.datasets).selectedIndices;
    if (selectedIndices.length == 1) {
      this._showDetailsForDataset(this._datasetsList[selectedIndices[0]]);
    } else {
      this._clearDatasetDetails();
    }
  }

  /**
   * Called when the element is detached from the DOM. Cleans up event listeners.
   */
  disconnectedCallback() {
  }
}

customElements.define(DataElement.is, DataElement);
