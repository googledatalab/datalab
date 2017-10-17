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

type ListTabledataResponse = gapi.client.bigquery.ListTabledataResponse;

describe('<table-inline-details>', () => {
  let testFixture: TableInlineDetailsElement;

  const mockTable: gapi.client.bigquery.Table = {
    creationTime: '1501541271001',
    etag: 'testEtag',
    id: 'pid:did.tid',
    kind: 'table',
    labels: [{
      name: 'label1',
      value: 'label1val',
    }],
    lastModifiedTime: '1501607994768',
    location: 'testLocation',
    numBytes: (1024 * 1023).toString(),
    numLongTermBytes: (1024 * 1024 * 50).toString(),
    numRows: '1234567890',
    schema: {
      fields: [{
        mode: 'mode1',
        name: 'field1',
        type: 'value1',
      }, {
        name: 'field2',
        type: 'value2',
      }],
    },
    selfLink: 'testLink',
    tableReference: {
      datasetId: 'did',
      projectId: 'pid',
      tableId: 'tid',
    },
    type: 'table',
  };

  const mockTabledata: ListTabledataResponse = {
    kind: 'bigquery#tableDataList',
    etag: 'x',
    pageToken: '',
    rows: [
      {f: [{ v: 'r1f1' }, { v: 'r1f2' }]},
      {f: [{ v: 'r2f1' }, { v: 'r2f2' }]},
      {f: [{ v: 'r3f1' }, { v: 'r3f2' }]},
    ],
    totalRows: 0,
  };

  const fileForTableId = (tableId: string) => {
    return new BigQueryFile({
      icon: '',
      id: new DatalabFileId(tableId, FileManagerType.BIG_QUERY),
      name: '/',
      type: DatalabFileType.FILE,
    } as DatalabFile);
  };

  /**
   * Rows must be recreated on each test with the fixture, to avoid state leakage.
   */
  beforeEach(() => {
    GapiManager.bigquery.getTableDetails = (pid, did, tid) => {
      assert(!!pid && !!did && !!tid,
          'getTableDetails should be called with project, dataset, and table');

      const response = {
        result: mockTable,
      };
      return Promise.resolve(response) as
          Promise<gapi.client.HttpRequestFulfilled<gapi.client.bigquery.Table>>;
    };
    GapiManager.bigquery.getTableRows = (pid, did, tid, _maxResults) => {
      assert(!!pid && !!did && !!tid,
          'getTableDetails should be called with project, dataset, and table');

      const response = {
        result: mockTabledata,
      } as gapi.client.HttpRequestFulfilled<ListTabledataResponse>;
      return Promise.resolve(response) as
          Promise<gapi.client.HttpRequestFulfilled<gapi.client.bigquery.ListTabledataResponse>>;
    };

    testFixture = fixture('table-inline-details-fixture');
    Polymer.dom.flush();
  });

  it('displays an empty element if no table is provided', () => {
    assert(!testFixture.$.placeholder.hidden, 'placeholder should be shown');
    assert(testFixture.$.container.hidden, 'container should be hidden');
    assert(testFixture.$.placeholder.querySelector('paper-spinner'),
        'spinner should be hidden if no table is loading');
  });

  it('loads the table schema', (done: () => null) => {
    testFixture.addEventListener('_table-changed', () => {
      Polymer.dom.flush();

      assert(JSON.stringify((testFixture as any)._table) === JSON.stringify(mockTable),
          'element should have fetched table info');

      const schemaRow = testFixture.$.tabledata.querySelector('tr.header');
      const columns = schemaRow.querySelectorAll('th');
      assert(columns.length === mockTable.schema.fields.length,
          'unexpected number of schema rows');

      mockTable.schema.fields.forEach((field, i) => {
        const nameSpan = schemaRow.children[i].querySelector('span.field-name');
        const typeSpan = schemaRow.children[i].querySelector('span.field-type');
        assert(nameSpan.innerText === field.name, 'field name does not match');
        assert(typeSpan.innerText === field.type, 'field type does not match');
      });

      done();
    });

    testFixture.file = fileForTableId('pid/did/tid');
  });

  it('loads the table data', (done: () => null) => {
    testFixture.addEventListener('_rows-changed', () => {
      Polymer.dom.flush();

      assert(JSON.stringify((testFixture as any)._rows) ===
             JSON.stringify(mockTabledata.rows),
          'element should have fetched table rows');

      const dataRows = testFixture.$.tabledata.querySelectorAll('tr.data');
      assert(dataRows.length === mockTabledata.rows.length,
          'unexpected number of schema rows');

      mockTabledata.rows.forEach((row, r) => {
        const dataFields = dataRows[r].querySelectorAll('td');
        assert(dataFields.length === row.f.length,
            'column count does not match');
        row.f.forEach((field, f) => {
          assert(field.v === dataFields[f].innerText, 'field data does not match');
        });
      });

      done();
    });

    testFixture.file = fileForTableId('pid/did/tid');
  });

  // TODO - after we figure out how we should deal with errors,
  // add some tests for that here.
});
