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
 * Table details pane element for Datalab.
 * This element is designed to be displayed in a side bar that displays more
 * information about a selected BigQuery table.
 */
class TableDetailsElement extends Polymer.Element {

  /**
   * Id for table whose details to show.
   */
  public tableId: string;

  private _table: gapi.client.bigquery.Table | null;
  private _busy = false;
  private readonly DEFAULT_MODE = 'NULLABLE';

  static get is() { return 'table-details'; }

  static get properties() {
    return {
      _table: {
        type: Object,
        value: null,
      },
      creationTime: {
        computed: '_computeCreationTime(_table)',
        type: String,
      },
      lastModifiedTime: {
        computed: '_computeLastModifiedTime(_table)',
        type: String,
      },
      longTermTableSize: {
        computed: '_computeLongTermTableSize(_table)',
        type: String,
      },
      numRows: {
        computed: '_computeNumRows(_table)',
        type: String,
      },
      tableId: {
        observer: '_tableIdChanged',
        type: String,
        value: '',
      },
      tableSize: {
        computed: '_computeTableSize(_table)',
        type: String,
      },
    };
  }

  _tableIdChanged() {
    const matches = this.tableId.match(/^(.*):(.*)\.(.*)$/);
    if (matches && matches.length === 4) { // The whole string is matched as first result
      this._busy = true;
      const projectId = matches[1];
      const datasetId = matches[2];
      const tableId = matches[3];

      GapiManager.getBigqueryTableDetails(projectId, datasetId, tableId)
        .then((response: HttpResponse<gapi.client.bigquery.Table>) => {
          this._table = response.result;
        }, (errorResponse) =>
            console.error('Failed to get table details: ' + errorResponse.body))
        .then(() => this._busy = false);
    } else {
      this._table = null;
    }
  }

  _computeCreationTime(table: gapi.client.bigquery.Table | null) {
    if (table) {
      return new Date(parseInt(table.creationTime, 10)).toLocaleString();
    } else {
      return '';
    }
  }

  _computeLastModifiedTime(table: gapi.client.bigquery.Table | null) {
    if (table) {
      return new Date(parseInt(table.lastModifiedTime, 10)).toLocaleString();
    } else {
      return '';
    }
  }

  _computeNumRows(table: gapi.client.bigquery.Table | null) {
    return table ? parseInt(table.numRows, 10).toLocaleString() : '';
  }

  _computeLongTermTableSize(table: gapi.client.bigquery.Table | null) {
    return table ? this._bytesToReadableSize(table.numLongTermBytes) : '';
  }

  _computeTableSize(table: gapi.client.bigquery.Table | null) {
    return table ? this._bytesToReadableSize(table.numBytes) : '';
  }

  /**
   * Converts the given number of bytes into a human readable string with units
   * and a two-decimal-point number
   */
  _bytesToReadableSize(bytesStr: string) {
    const kilo = 1024;
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let bytesLeft = parseInt(bytesStr, 10);
    let level = 0;

    while (bytesLeft >= kilo) {
      bytesLeft /= kilo;
      ++level;
    }
    return bytesLeft.toFixed(2) + ' ' + units[level];
  }

  _formatMode(mode: string) {
    return mode || this.DEFAULT_MODE;
  }

}

customElements.define(TableDetailsElement.is, TableDetailsElement);
