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

/// <reference path="../../modules/GapiManager.ts" />
/// <reference path="../input-dialog/input-dialog.ts" />
/// <reference path="../item-list/item-list.ts" />

type HttpResponse<T> = gapi.client.HttpResponse<T>;

interface Result {
  name: string;
  type: string;
}

/**
 * Data element for Datalab.
 * Contains a form for initial user input, and a list of results.
 */
class DataElement extends Polymer.Element {

  private _resultsList: Result[];
  private _searchValue: string;

  static get is() { return 'datalab-data'; }

  static get properties() {
    return {
      _resultsList: {
        observer: '_renderResultsList',
        type: Array,
        value: () => [],
      },
      _searchValue: {
        observer: '_search',
        type: String,
        value: '',
      },
    };
  }

  ready() {
    super.ready();

    this._resultsList = [];
    const resultsElement = this.$.results as ItemListElement;
    if (resultsElement) {
      resultsElement.addEventListener('itemDoubleClick',
                                    this._resultsDoubleClicked.bind(this));
      resultsElement.addEventListener('selected-indices-changed',
                                    this._resultsSelectionChanged.bind(this));
    }

    (this.$.results as ItemListElement).columns = ['Name', 'Type'];
    this.$.searchKeys.target = this.$.searchBox;
  }

  /** Sends the user's query to the search API, renders results as they get returned. */
  _search() {
    // TODO - clearing the resultsList may cause unnecessary refreshes, clean this up
    //   when we figure out how we actually want to handle the search call.
    this._resultsList = [];
    this._sendQuery(this._searchValue, this._handleQueryResults.bind(this));
  }

  _sendQuery(searchValue: string, resultHandler: (partialResults: Result[]) => void) {
    this._callBigQuery(searchValue, resultHandler);
  }

  _handleQueryResults(partialResults: Result[]) {
    // TODO - add something to make sure the partialResults are for the right query,
    //   so that late results don't accidentally get added to the next query results.
    this._resultsList = this._resultsList.concat(partialResults);
  }

  // Make some calls to the BigQuery API and pass the results to the resultHandler
  _callBigQuery(searchValue: string, resultHandler: (partialResults: Result[]) => void) {
    // const sampleProject = 'bigquery-public-data';
    // GapiManager.listBigQueryProjects()
    //     .then((response: HttpResponse<gapi.client.bigquery.ListProjectsResponse>) => {
    //       console.log('== projects: ', response);
    //       const projectResults: Result[] = response.result.projects.map(this._bqProjectToResult.bind(this)) as Result[];
    //       resultHandler(projectResults);
    //     })
    //     .catch(() => {
    //       // TODO: handle errors getting projects
    //     });
    // // The filter arg when querying for datasets must be of the form labels.<name>[:<value>],
    // // see https://cloud.google.com/bigquery/docs/reference/rest/v2/datasets/list
    // GapiManager.listBigQueryDatasets(sampleProject, searchValue /* label filter */)
    //     .then((response: HttpResponse<gapi.client.bigquery.ListDatasetsResponse>) => {
    //       console.log('== datasets: ', response);
    //       const datasetResults: Result[] = response.result.datasets.map(this._bqDatasetToResult.bind(this)) as Result[];
    //       resultHandler(datasetResults);
    //     })
    //     .catch(() => {
    //       // TODO: handle errors getting projects
    //     });
    GapiManager.listBigQueryTables('yelsayed-project1', searchValue /* datasetId */)
        .then((response: HttpResponse<gapi.client.bigquery.ListTablesResponse>) => {
          console.log('== tables: ', response);
          const tableResults: Result[] = response.result.tables.map(this._bqTableToResult.bind(this)) as Result[];
          resultHandler(tableResults);
        })
        .catch(() => {
          // TODO: handle errors getting projects
        });
  }

  _bqProjectToResult(bqProject: gapi.client.bigquery.ProjectResource): Result {
    return {
      name: bqProject.id,
      type: 'project',
    } as Result;
  }

  _bqDatasetToResult(bqDataset: gapi.client.bigquery.DatasetResource): Result {
    return {
      name: bqDataset.id,
      type: 'dataset',
    } as Result;
  }

  _bqTableToResult(bqTable: gapi.client.bigquery.TableResource): Result {
    return {
      name: bqTable.id,
      type: 'table',
    } as Result;
  }

  /**
   * Creates a new ItemListRow object for each entry in the results list, and sends
   * the created list to the item-list to render.
   */
  _renderResultsList() {
    this.$.results.rows = this._resultsList.map((result) => {
      return {
        firstCol: result.name,
        icon: this._typeToIcon(result.type),
        secondCol: result.type,
        selected: false,
      };
    });
  }

  _typeToIcon(type: string): string {
    const typeMap: {[key: string]: string; } = {
      dataset: 'folder',
      project: 'view-quilt',
      table: 'list',
    };
    return typeMap[type] || 'folder';
  }

  _resultsDoubleClicked() {
    console.log('== result double-clicked');
  }

  _resultsSelectionChanged() {
    const selectedIndices = (this.$.results as ItemListElement).selectedIndices;
    if (selectedIndices.length === 1) {
      const selectedItem = this._resultsList[selectedIndices[0]];
      if (selectedItem.type === 'table') {
        (this.$.preview as TablePreviewElement).tableId = selectedItem.name;
      }
    } else {
      (this.$.preview as TablePreviewElement).tableId = '';
    }
  }
}

customElements.define(DataElement.is, DataElement);
