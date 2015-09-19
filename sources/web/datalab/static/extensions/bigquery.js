/*
 * Copyright 2015 Google Inc. All rights reserved.
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

define(['extensions/charting'], function(charting) {

  function evaluateUDF(dom, udf, data) {
    var results = [];
    data.forEach(function(row) {
      udf(row, function(result) {
        results.push(result);
      });
    });

    charting.render(dom, { chartStyle: 'table' }, null, results);
  }

  // Event handler to toggle visibility of a nested schema table.
  function _toggleNode(e) {
    var node = e.target;
    var expand = node.className == 'bqsv_collapsed';
    node.className = expand ? 'bqsv_expanded' : 'bqsv_collapsed';
    var tgroup = node.parentNode.nextSibling;
    tgroup.className = expand ? 'bqsv_visible' : 'bqsv_hidden';
  }

  // Helper function to recursively render a table schema.
  function _renderSchema(table, schema, title, includeColumnHeaders, columns) {

    // Create a tbody element to hold the entities for this level. We group them so
    // we can easily collapse/expand the level.
    var tbody = document.createElement('tbody');

    for (var i = 0; i < schema.length; i++) {
      if (i == 0) {
        if (title.length > 0) {
          // title.length > 0 implies we are in a nested table. Create a title header row
          // for this nested table with a click handler and hide the tbody.

          tbody.className = 'bqsv_hidden';

          var th = document.createElement('th');
          th.colSpan = columns.length;
          th.className = 'bqsv_collapsed';
          th.textContent = title.substring(1);  // skip the leading '.'
          th.addEventListener('click', _toggleNode);

          var tr = document.createElement('tr');
          tr.appendChild(th);
          table.appendChild(tr);
        } else {
          // We are in the top-level table; add a header row with the column labels.
          tbody.className = 'bqsv_visible';
          if (includeColumnHeaders) {
            // First line; show column headers.
            var tr = document.createElement('tr');
            for (var j = 0; j < columns.length; j++) {
              var th = document.createElement('th');
              th.textContent = columns[j];
              th.className = 'bqsv_colheader';
              tr.appendChild(th);
            }
            table.appendChild(tr);
          }
        }
      }

      // Add the details for the current row to the tbody.
      var field = schema[i];
      var tr = document.createElement('tr');
      for (var j = 0; j < columns.length; j++) {
        var td = document.createElement('td');
        var v = field[columns[j]];
        td.textContent = v == undefined ? '' : v;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    // Add the tbody with all the rows to the table.
    table.appendChild(tbody);

    // Recurse into any nested tables.
    for (var i = 0; i < schema.length; i++) {
      var field = schema[i];
      if (field.type == 'RECORD') {
        _renderSchema(table, field.fields, title + '.' + field.name, false, columns);
      }
    }
  }

  // Top-level public function for schema rendering.
  function renderSchema(dom, schema) {
    var columns = ['name', 'type', 'mode', 'description'];
    var table = document.createElement('table');
    table.className = 'bqsv';
    _renderSchema(table, schema, '', /*includeColumnHeaders*/ true, columns);
    dom.appendChild(table);
  }

  return {
    renderSchema: renderSchema,
    evaluateUDF: evaluateUDF
  };
});
