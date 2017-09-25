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
 * Table inline details pane element for Datalab.
 * Displays information about the selected BigQuery table file inline in the
 * file browser item list.
 */
class TableInlineDetailsElement extends Polymer.Element {

  /**
   * File whose details to show.
   */
  public file: BigQueryFile;

  private _fileManager: FileManager;
  private _rows: gapi.client.bigquery.TabledataRow[];
  private _table: gapi.client.bigquery.Table | null;
  private _busy = false;
  private readonly TABLE_PREVIEW_ROW_COUNT = 5;

  static get is() { return 'table-inline-details'; }

  static get properties() {
    return {
      _rows: {
        notify: true, // For unit tests
        type: Object,
        value: null,
      },
      _schemaFields: {
        computed: '_computeSchemaFields(_table)',
        type: Array,
      },
      _table: {
        notify: true, // For unit tests
        type: Object,
        value: null,
      },
      file: {
        observer: '_fileChanged',
        type: Object,
        value: {},
      },
    };
  }

  constructor() {
    super();

    this._fileManager = FileManagerFactory.getInstance();
  }

  _fileChanged() {
    const path = this.file && this.file.id && this.file.id.path;
    const pathParts = path ? path.split('/') : [];

    if (pathParts.length === 3) {
      this._busy = true;
      const projectId = pathParts[0];
      const datasetId = pathParts[1];
      const tableId = pathParts[2];

      GapiManager.bigquery.getTableDetails(projectId, datasetId, tableId)
        .then((response: HttpResponse<gapi.client.bigquery.Table>) => {
          this._table = response.result;
        }, (errorResponse: any) =>
            // TODO - display error to user in the details pane
            Utils.log.error('Failed to get table details: ' + errorResponse.body))
        .then(() => GapiManager.bigquery.getTableRows(
            projectId, datasetId, tableId, this.TABLE_PREVIEW_ROW_COUNT))
        .then((response: HttpResponse<gapi.client.bigquery.ListTabledataResponse>) => {
          this._rows = response.result.rows;
        }, (errorResponse: any) =>
            // TODO - display error to user in the details pane
            Utils.log.error('Failed to get table rows: ' + errorResponse.body))
        .then(() => this._busy = false);
    } else {
      this._table = null;
      this._rows = [];
    }
  }

  _computeSchemaFields(table: gapi.client.bigquery.Table | null) {
    return table ? Utils.flattenFields(table.schema.fields) : [];
  }
}

customElements.define(TableInlineDetailsElement.is, TableInlineDetailsElement);
