/*
 * Copyright 2014 Google Inc. All rights reserved.
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

define(function () {

  var chartMap = {
    area: {name: 'AreaChart'},
    columns: {name: 'ColumnChart'},
    bars: {name: 'BarChart'},
    histogram: {name: 'Histogram'},
    line: {name: 'LineChart'},
    pie: {name: 'PieChart'},
    scatter: {name: 'ScatterChart'},
    // TODO(gram): remove this once renderTable works. Remove from argparse too.
    table: {script: 'table', name: 'Table', optionHandler: addTableOptions}
  };

  function addTableOptions(options, rowsPerPage) {
    options = options || {};
    options['sort'] = 'disable';
    options['page'] = 'event';
    options['showRowNumber'] = true;
    if (options['pageSize'] == undefined || options['pageSize'] <= 0) {
      options['pageSize'] = rowsPerPage;
    }
    return options;
  }

  function render(chartType, dom, dataName, fields, options, totalRows, rowsPerPage) {
    var chartInfo = chartMap[chartType];
    var chartScript = chartInfo.script || 'corechart';
    fields = fields || '*';
    options = options || {};
    totalRows = totalRows || -1;
    if (chartInfo.optionHandler) {
      options = chartInfo.optionHandler(options, (rowsPerPage || 25));
    }
    var data = undefined;
    var fetchCode = '%_get_chart_data ' + dataName + ' ' + fields;
    var dataOffset = 0; // Offset of data array in all data.
    var firstRow = 0; // Offset of first line being displayed

    require(['visualization!' + chartScript], function (visualization) {
      var chartType = visualization[chartInfo.name];
      var chart = new chartType(dom);

      // Function to get a range of data and call us back with a DataTable. We must supply
      // a first row, and optionally a count; if the latter is not supplied then all data
      // to the end of the object will be fetched.
      var getData = function(successCallback, errorCallback, startRow, count) {

        var len = data ? data['rows'].length : 0;
        console.log("In getData - startRow " + startRow + ", count " + count +
            ", totalRows " + totalRows + ", data.length " + len + ", dataOffset " +
            dataOffset + ", firstRow " + firstRow);

        if (totalRows >= 0) {
          if (!count || count > totalRows - startRow) {
            count = totalRows - startRow;
          }
        }

        if (count && startRow >= dataOffset && (startRow + count) <= (dataOffset + len)) {
          console.log("Can satisfy from cache");
          firstRow = startRow;
          successCallback(startRow, count);
        } else {
          var first = startRow - 1000;
          var last;
          if (first < 0) {
            first = 0;
          }
          if (count) {
            last = firstRow + count + 1000;
            if (totalRows >= 0 && last >= totalRows) {
              last = totalRows - 1;
            }
          } else {
            last = undefined;
          }
          var code = fetchCode + ' ' + first;
          if (last) {
            code += ' ' + (last - first + 1);
          }
          // TODO(gram): remove next line; useful for now for debugging cell magic
          console.log("Running " + code);
          IPython.notebook.kernel.get_data(code, function (newData, error) {
            if (error) {
              errorCallback(error);
            } else {
              data = newData['data'];
              dataOffset = first;
              firstRow = startRow;
              // If we didn't know the data length before we might now if we had an incomplete
              // fetch or were fetching all the rows.
              var len = data['rows'].length;
              if (totalRows < 0 && (!last || len != (last - first + 1))) {
                totalRows = first + len;
                console.log("Setting totalRows to " + totalRows);
                if (!count || (firstRow + count) > totalRows) {
                  count = totalRows - firstRow;
                }
              }
              console.log("After fetch: dataOffset " + dataOffset + ", data.length " + len +
                  ", firstRow " + firstRow + ", startRow " + startRow + ", count " + count);
              successCallback(startRow, count);
            }
          });
        }
      };

      var successCallback = function(startRow, count) {
        if (dataOffset = 0 && startRow == 0 && count == data['rows'].length) {
          // No need to slice a page.
          var dt = new visualization.DataTable(data);
        } else {
          var pageData = {
            'cols':data['cols'],
            'rows':data['rows'].slice(startRow - dataOffset, startRow - dataOffset + count)
          };
          var dt = new visualization.DataTable(pageData);
        }
        options['firstRowNumber'] = startRow + 1;
        if (options['pageSize']) {
          options['startPage'] = startRow / options['pageSize'] + 1;
        }
        if (totalRows < 0 || startRow + count < totalRows) {
          options['pagingButtonsConfiguration'] = startRow > 0 ? 'both' : 'next';
        } else { // no next
          options['pagingButtonsConfiguration'] = startRow > 0 ? 'prev' : 'none';
          if (startRow == 0) {
            options['page'] = 'disable';
          }
        }
        chart.draw(dt, options);
      };

      var errorCallback = function(error) {
        var message = 'The data could not be retrieved.' + error.toString();
        visualization.errors.addError(dom, 'Unable to render the chart',
            message, {'showInTooltip': false});
      };

      var handlePage = function(properties) {
        var offset = properties['page']; // 1, -1 or 0
        console.log('offset ' + offset);
        // For some reason Google Charts API gives a zero if you click the left button.
        if (offset == 0) {
          offset = -1;
        }
        var newFirstRow = 0;
        var pageSize = options['pageSize'];
        console.log("In handlePage, offset="+offset + ", pageSize " + pageSize);
        if (offset != 0) {
          newFirstRow = firstRow + offset * pageSize;
        }
        if (newFirstRow >= 0 && (totalRows < 0 || newFirstRow < totalRows)) {
          getData(successCallback, errorCallback, newFirstRow, pageSize);
        }
      };

      var count = undefined;
      if (options['pageSize']) {
        count = options['pageSize'];
        visualization.events.addListener(chart, 'page', function(e) {
          handlePage(e)
        });
      }

      getData(successCallback, errorCallback, firstRow, count);
    });
  }

  return {
    render: render
  };
});
