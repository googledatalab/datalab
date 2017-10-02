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

describe('<table-preview>', () => {
  let testFixture: TablePreviewElement;

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

    testFixture = fixture('table-preview-fixture');
    testFixture.tableId = '';
    Polymer.dom.flush();
  });

  it('loads the table given its id and gets its details', (done: () => null) => {
    testFixture.addEventListener('_table-changed', () => {
      Polymer.dom.flush();

      assert(JSON.stringify((testFixture as any)._table) === JSON.stringify(mockTable),
          'element should have fetched table info');

      assert(testFixture.$.tableId.innerText === mockTable.tableReference.tableId,
            'table id should be parsed');
      assert(testFixture.$.projectId.innerText === mockTable.tableReference.projectId,
            'project id should be parsed');
      assert(testFixture.$.datasetId.innerText === mockTable.tableReference.datasetId,
            'dataset id should be parsed');
      assert(testFixture.$.tableSize.innerText === '1023.00 KB', 'should see readable table size');
      assert(testFixture.$.longTermTableSize.innerText === '50.00 MB',
          'should see readable long term table size');
      assert(testFixture.$.numRows.innerText === '1,234,567,890',
          'should see comma-separated number of rows');
      assert(testFixture.$.creationTime.innerText === 'Mon, 31 Jul 2017 22:47:51 GMT',
          'should parse timestamp into readable text');
      assert(testFixture.$.lastModifiedTime.innerText === 'Tue, 01 Aug 2017 17:19:54 GMT',
          'should parse timestamp into readable text');
      assert(testFixture.$.location.innerText === mockTable.location, 'should see location');

      assert(testFixture.$.schema.rows.length === mockTable.schema.fields.length,
          'unexpected number of schema rows');

      const rows = testFixture.$.schema.rows;
      mockTable.schema.fields.forEach((field, i) => {
        assert(rows[i].children[0].innerText === field.name, 'field name not matching');
        assert(rows[i].children[1].innerText === field.type, 'field type not matching');
        assert(rows[i].children[2].innerText === (field.mode || 'NULLABLE'),
            'field mode not matching');
      });

      done();
    });

    testFixture.tableId = 'pid:did.tid';
  });

  it('flattens out the provided table\'s schema if it has nested columns', (done: () => null) => {
    const f1: gapi.client.bigquery.Field = {
      name: 'testRegular',
      type: 'INTEGER',
    };
    const f2: gapi.client.bigquery.Field = {
      fields: [{
        name: 'nestedLevel1',
        type: 'nestedLevel1Type',
      }],
      name: 'testRecord',
      type: 'RECORD',
    };

    testFixture.addEventListener('_table-changed', () => {
      Polymer.dom.flush();

      const rows = testFixture.$.schema.rows;
      assert(rows[0].children[0].innerText === f1.name, 'regular field name not matching');
      assert(rows[0].children[1].innerText === f1.type, 'regular field type not matching');

      assert(rows[1].children[0].innerText === f2.name, 'record field name not matching');
      assert(rows[1].children[1].innerText === f2.type, 'record field type not matching');

      if (f2.fields) { // For transpiler to rule out undefined
        assert(rows[2].children[0].innerText === f2.name + '.' + f2.fields[0].name,
            'nested field name should contain parent and nested field names');
        assert(rows[2].children[1].innerText === f2.fields[0].type,
            'nested field type not matching');
      }

      done();
    });

    mockTable.schema.fields = [f1, f2];

    testFixture.tableId = 'pid:did.tid';
  });

});
