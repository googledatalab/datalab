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

declare function assert(condition: boolean, message: string): null;
declare function fixture(element: string): any;

/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />
/// <reference path="../components/table-details/table-details.ts" />
/// <reference path="../../../../../third_party/externs/ts/gapi/gapi.d.ts" />

/*
 * For all Polymer component testing, be sure to call Polymer's flush() after
 * any code that will cause shadow dom redistribution, such as observed array
 * mutation, wich is used by the dom-repeater in this case.
 */

describe('<table-details>', () => {
  let testFixture: TableDetailsElement;

  const mockTable: gapi.client.bigquery.BigqueryTable = {
    creationTime: '1501541271001',
    etag: 'testEtag',
    id: 'pid:did.tid',
    kind: 'table',
    labels: [{
      name: 'label1',
      value: 'label1val',
    }],
    lastModifiedTime: '1501541271001',
    location: 'testLocation',
    numBytes: (1024 * 1023).toString(),
    numLongTermBytes: (1024 * 1024 * 50).toString(),
    numRows: '1234567890',
    schema: {
      fields: [{
        name: 'field1',
        type: 'value1',
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
    GapiManager.getTableDetails = (pid, did, tid) => {
      assert(!!pid && !!did && !!tid,
          'getTableDetails should be called with project, dataset, and table');

      const request = {
        body: mockTable,
      };
      return Promise.resolve(request) as any;
    };

    testFixture = fixture('table-details-fixture');
    testFixture.tableId = '';
    Polymer.dom.flush();
  });

  it('displays an empty element if no table is provided', () => {
    assert(!testFixture.$.placeholder.hidden, 'placeholder should be shown');
    assert(testFixture.$.container.hidden, 'container should be hidden');
    assert(testFixture.$.placeholder.querySelector('paper-spinner'),
        'spinner should be hidden if no table is loading');
  });

  it('loads the table given its id and gets its details', () => {
    testFixture.tableId = 'pid:did.tid';
    Polymer.dom.flush();

    debugger;
    assert((testFixture as any)._table === mockTable, 'element should have fetched table info');
  });

});
