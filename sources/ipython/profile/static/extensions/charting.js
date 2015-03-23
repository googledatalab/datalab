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

  // For each chart type, we have a constructor name, and optionally a package to load
  // ('script').
  var chartMap = {
    annotation: {name: 'AnnotationChart', script: 'annotationchart'},
    area: {name: 'AreaChart'},
    columns: {name: 'ColumnChart'},
    bars: {name: 'BarChart'},
    bubbles: {name: 'BubbleChart'},
    calendar: {name: 'Calendar', script: 'calendar'},
    candlestick: {name: 'CandlestickChart'},
    combo: {name: 'ComboChart'},
    gauge: {name: 'Gauge', script: 'gauge'},
    geo: {name: 'GeoChart', script: 'geochart'},
    histogram: {name: 'Histogram'},
    line: {name: 'LineChart'},
    map: {name: 'Map', script: 'map'},
    org: {name: 'OrgChart', script: 'orgchart'},
    paged_table: {name: 'Table', script: 'table'},
    pie: {name: 'PieChart'},
    sankey: {name: 'Sankey', script: 'sankey'},
    scatter: {name: 'ScatterChart'},
    stepped_area: {name: 'SteppedAreaChart'},
    table: {name: 'Table', script: 'table'},
    timeline: {name: 'Timeline', script: 'timeline'},
    treemap: {name: 'TreeMap', script: 'treemap'},
  };

  function render(chartStyle, dom, dataName, fields, options, totalRows, rowsPerPage) {
    var chartInfo = chartMap[chartStyle];
    var chartScript = chartInfo.script || 'corechart';
    fields = fields || '*';
    options = options || {};
    totalRows = totalRows || -1;
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

        if (totalRows >= 0) {
          if (!count || count > totalRows - startRow) {
            count = totalRows - startRow;
          }
        }

        if (count && startRow >= dataOffset && (startRow + count) <= (dataOffset + len)) {
          // Satisfy the request from our cached data.
          firstRow = startRow;
          var result = successCallback(startRow, count);
          if (result) {
            errorCallback(result);
          }
        } else {
          // Fetch data. We try fetch up to 1000 lines before and 1000 rows after the page
          // we are viewing.
          // TODO(gram): At some point we should optimize this more. If the user paginates
          // sequentially - which is all they can do right now with gViz - then we will
          // typically be requesting a new dataset with ~1000 rows overlap with the previous
          // dataset. We should recycle the rows we have and ask just for the ones we don't.
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
            var count = (last - first + 1);
            code += ' ' + count;
          }
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
                if (!count || (firstRow + count) > totalRows) {
                  count = totalRows - firstRow;
                }
              }
              // We need to convert any string fields that are date type to JS Dates.
              for (var i = 0; i < data['cols'].length; i++) {
                if (data['cols'][i].type == 'datetime') {
                  var rows = data['rows'];
                  for (var j = 0; j < rows.length; j++) {
                    rows[j]['c'][i]['v'] = new Date(rows[j]['c'][i]['v']);
                  }
                }
              }
              var result = successCallback(startRow, count);
              if (result) {
                errorCallback(result);
              }
            }
          });
        }
      };

      var successCallback = function(startRow, count) {
        if (chartStyle == 'paged_table') {
          // Adjust the options that affect the page display.
          if (options['showRowNumber'] == undefined) {
            options['showRowNumber'] = true;
          }
          options['page'] = 'event';
          options['firstRowNumber'] = startRow + 1;
          if (totalRows < 0 || startRow + count < totalRows) {
            options['pagingButtonsConfiguration'] = startRow > 0 ? 'both' : 'next';
          } else { // no next
            options['pagingButtonsConfiguration'] = startRow > 0 ? 'prev' : 'none';
            if (startRow == 0) {
              options['page'] = 'disable';
            }
          }
          if (options['page'] != 'disable') {
            // We can't sort if we are paginating.
            options['sort'] = 'disable';
          }
        }
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
        chart.draw(dt, options);
      };

      var errorCallback = function(error) {
        var message = 'The data could not be retrieved.' + error.toString();
        visualization.errors.addError(dom, 'Unable to render the chart',
            message, {'showInTooltip': false});
      };

      var handlePage = function(properties) {
        var offset = properties['page']; // 1, -1 or 0
        // The Google Charts API gives a zero if you click the left button.
        if (offset == 0) {
          offset = -1;
        }
        var newFirstRow = 0;
        var pageSize = options['pageSize'];
        if (offset != 0) {
          newFirstRow = firstRow + offset * pageSize;
        }
        if (newFirstRow >= 0 && (totalRows < 0 || newFirstRow < totalRows)) {
          getData(successCallback, errorCallback, newFirstRow, pageSize);
        }
      };

      var count = undefined;
      if (chartStyle == 'paged_table') {
        if (options['pageSize'] == undefined || options['pageSize'] <= 0) {
          options['pageSize'] = rowsPerPage || 25;
        }
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
