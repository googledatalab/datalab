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

  /**
   * Id for table whose inline-details to show.
   */
  public tableId: string;

  private _apiManager: ApiManager;
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
      tableId: {
        observer: '_tableIdChanged',
        type: String,
        value: '',
      },
    };
  }

  constructor() {
    super();

    this._apiManager = ApiManagerFactory.getInstance();
    this._fileManager = FileManagerFactory.getInstance();
  }

  _fileChanged() {
    if (this.file && this.file.id) {
      // TODO(jimmc) - move this into BigQueryFile?
      const path = this.file.id.path;
      const parts = path.split('/');
      this.tableId = parts[0] + ':' + parts[1] + '.' + parts[2];
    } else {
      this.tableId = '';
    }
  }

  _tableIdChanged() {
    const matches = this.tableId.match(/^(.*):(.*)\.(.*)$/);
    if (matches && matches.length === 4) { // The whole string is matched as first result
      this._busy = true;
      const projectId = matches[1];
      const datasetId = matches[2];
      const tableId = matches[3];

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

  // TODO: Consider adding expanders and nested tables to make the schema viewer
  // narrower
  _flattenFields(fields: gapi.client.bigquery.Field[]) {
    const flatFields: gapi.client.bigquery.Field[] = [];
    fields.forEach((field) => {

      // First push the record field itself
      flatFields.push(field);

      // Then flatten it and push its children
      if (field.type === 'RECORD' && field.fields) {
        // Make sure we copy the flattened nested fields before modifying their
        // name to prepend the parent field name. This way the original name in
        // the schema object does not change.
        const nestedFields = [...this._flattenFields(field.fields)];
        nestedFields.forEach((f) => {
          const flat = {...f};
          flat.name = field.name + '.' + f.name;
          flatFields.push(flat);
        });
      }
    });
    return flatFields;
  }

  _computeSchemaFields(table: gapi.client.bigquery.Table | null) {
    return table ? this._flattenFields(table.schema.fields) : [];
  }
}

customElements.define(TableInlineDetailsElement.is, TableInlineDetailsElement);
