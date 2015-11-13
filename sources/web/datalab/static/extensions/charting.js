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
    treemap: {name: 'TreeMap', script: 'treemap'}
  };

  function convertListToDataTable(list) {
    if (!list || !list.length) {
      return { cols: [], rows: [] };
    }

    var firstItem = list[0];
    var names = Object.keys(firstItem);

    var columns = names.map(function(name) {
      return { id: name, label: name, type: typeof firstItem[name] }
    });

    var rows = list.map(function(item) {
      var cells = names.map(function(name) {
        return { v: item[name] };
      });
      return { c: cells };
    });

    return { cols: columns, rows: rows };
  }

  // Convert any string fields that are date type to JS Dates.
  function convertDates(data) {
    for (var i = 0; i < data.cols.length; i++) {
      if (data.cols[i].type == 'datetime') {
        var rows = data.rows;
        for (var j = 0; j < rows.length; j++) {
          rows[j].c[i].v = new Date(rows[j].c[i].v);
        }
      }
    }
  }

  function onError(visualization, dom, error) {
    var message = 'The data could not be retrieved.' + error.toString();
    visualization.errors.addError(dom, 'Unable to render the chart',
        message, {showInTooltip: false});
  }

  // Adjust any necessary options for the paged table and update the chart.
  function chartPage(model, startRow, count) {
    // Adjust the options that affect the page display.
    var options = model.options;
    if (options.showRowNumber == undefined) {
      options.showRowNumber = true;
    }
    options.page = 'event';
    options.firstRowNumber = startRow + 1;
    if (model.totalRows < 0 || startRow + count < model.totalRows) {
      // We either don't know where the end is or we're not at the end, so we can have 'next'.
      options.pagingButtonsConfiguration = startRow > 0 ? 'both' : 'next';
    } else { // no next
      // Reduce count if necessary on the last page.
      count = model.totalRows - startRow;
      options.pagingButtonsConfiguration = startRow > 0 ? 'prev' : 'none';
      if (startRow == 0) {
        // No next or prev so disable page events.
        options.page = 'disable';
      }
    }
    if (options.page != 'disable') {
      // We can't sort if we are paginating.
      options.sort = 'disable';
    }
    model.firstRow = startRow;
    var dt = new model.visualization.DataTable({
      'cols': model.data.cols,
      'rows': model.data.rows.slice(startRow - model.dataOffset,
          startRow - model.dataOffset + count)
    });
    model.chart.draw(dt, model.options);
  }

  // Check if a row is in the table. Note that if we don't know the total number of rows
  // we assume the row is in range as long as it is non-negative.
  function isRowInRange(row, totalRows) {
    return row >= 0 && (totalRows < 0 || row < totalRows);
  }

  // Calculate the number of rows we want to display.
  function getPageRowCount(model, startRow) {
    var count = model.options.pageSize;
    if (model.totalRows >= 0) { // We know how many rows we have.
      var rowsLeft = model.totalRows - startRow;
      if (count > rowsLeft) {
        count = rowsLeft;
      }
    }
    return count;
  }

  // Check if a row range is in the cached data.
  function isCached(model, startRow, count) {
    if (count == 0) {
      return true;
    }
    return startRow >= model.dataOffset &&
        (startRow + count) <= (model.dataOffset + model.data.rows.length);
  }

  // Function to get a range of data and update chart with one page of data.
  function getPagedData(model, startRow) {

    // Calculate the number of rows we want to display.
    var pageCount = getPageRowCount(model, startRow);

    if (isCached(model, startRow, pageCount)) {
      chartPage(model, startRow, pageCount);
    } else {

      // Fetch data. We try fetch up to 20 pages before and 20 pages after the page
      // we are viewing.
      // TODO(gram): At some point we should optimize this more. If the user paginates
      // sequentially - which is all they can do right now with gViz - then we will
      // typically be requesting a new dataset with ~20 pages overlap with the previous
      // dataset. We should recycle the rows we have and ask just for the ones we don't.

      var first = Math.max(startRow - 20 * model.options.pageSize, 0);
      var last = startRow + pageCount + 20 * model.options.pageSize;
      if (model.totalRows >= 0 && last >= model.totalRows) { // Can't go past the end of the data
        last = model.totalRows - 1;
      }
      var fetchCount = last - first + 1;
      var code = model.fetchCode + ' ' + first + ' ' + fetchCount;

      datalab.session.execute(code, function (error, newData) {
        if (error) {
          onError(model.visualization, model.dom, error);
        } else {
          convertDates(newData.data);
          model.data = newData.data;
          model.dataOffset = first;
          // If we didn't know the data length before we do now if we got less than we asked for.
          if (model.totalRows < 0) {
            var len = model.data.rows.length;
            if (len != fetchCount) {
              model.totalRows = first + len;
            }
          }
          chartPage(model, startRow, pageCount);
        }
      });
    }
  }

  // Handle page forward/back events. Page will only be 0 or 1.
  function handlePageEvent(model, page) {
    var offset = (page == 0) ? -1 : 1;
    var newFirstRow = model.firstRow + offset * model.options.pageSize;
    if (isRowInRange(newFirstRow, model.totalRows)) {
      getPagedData(model, newFirstRow);
    }
  }

  // The main render method, called from Python-generated code. dom is the DOM element
  // for the chart, model is a set of parameters from Python, and options is a JSON
  // set of options provided by the user in the cell magic body, which takes precedence over
  // model. An initial set of data can be passed in as a final optional parameter.
  function render(dom, model, options, data) {
    var chartInfo = chartMap[model.chartStyle];
    var chartScript = chartInfo.script || 'corechart';
    dom.innerHTML = '';

    if (!data.cols && !data.rows) {
      data = convertListToDataTable(data);
    }
    convertDates(data);

    require(['visualization!' + chartScript], function (visualization) {
      var chartType = visualization[chartInfo.name];
      var chart = new chartType(dom);

      if (chart.getImageURI != undefined) {
        google.visualization.events.addListener(chart, 'ready', function () {
          // Find this cell in the notebook and add this as a image/png display output.
          var cells = IPython.notebook.get_cells();
          for (var cellindex in cells) {
            var cell = cells[cellindex];
            if (cell.cell_type == 'code') {
              var cell_outputs = cell.output_area.outputs;
              for (var outputindex in cell_outputs) {
                var output = cell_outputs[outputindex].data;
                for (var mimetype in output) {
                  if (mimetype != 'text/html') {
                    continue;
                  }
                  var data = output[mimetype];
                  if (data.indexOf('<div class="bqgc" id="' + dom.id) >= 0) {
                    // We see if we already have an output for the PNG. If so we want to find its
                    // element and hide it so it doesn't show up twice. If not, we add it to the 
                    // notebook (but don't display it).
                    if (cell_outputs.length > 1) {
                      var elements = cell.output_area.element;
                      for (var i = 0; i < elements.length; i++) {
                        var pngs = elements[i].getElementsByClassName('output_png');
                        if (pngs) {
                          // Should just be one but anyway...
                          for (var j = 0; j < pngs.length; j++) {
                            pngs[j].style.display = "none";
                          }
                        }
                      }
                    } else {
                      var static_chart = chart.getImageURI();
                      var img = static_chart.substr(static_chart.indexOf(',') + 1);  // strip leading base64 etc.
                      cell_outputs.push({
                        metadata: {},
                        data: {
                          'image/png': img
                        },
                        output_type: 'display_data'
                      });
                    }
                  }
                }
              }
            }
          }
        });
      }

      options = options || {};
      if ((model.chartStyle == 'paged_table') || (model.chartStyle == 'table')) {
        // Cleanup table rendering
        options.cssClassNames = {
          tableRow: 'gchart-table-row',
          headerRow: 'gchart-table-headerrow',
          oddTableRow: 'gchart-table-oddrow',
          selectedTableRow: 'gchart-table-selectedrow',
          hoverTableRow: 'gchart-table-hoverrow',
          tableCell: 'gchart-table-cell',
          headerCell: 'gchart-table-headercell',
          rowNumberCell: 'gchart-table-rownumcell'
        };
      }

      if (model.chartStyle != 'paged_table') {
        chart.draw(new visualization.DataTable(data), options);
      }
      else {
        if (options.pageSize == undefined) {
          options.pageSize = model.rowsPerPage || 25;
        }
        model.dom = dom;
        model.chart = chart;
        model.visualization = visualization;
        model.fetchCode = '%_get_chart_data ' + model.dataName + ' ' + (model.fields || '*');
        model.options = options;
        model.totalRows = model.totalRows || -1; // Total rows in all (server-side) data.
        model.dataOffset = 0; // Where the cached data[] array starts from.
        model.firstRow = 0;  // Index of first row being displayed in page.

        model.data = data;

        visualization.events.addListener(chart, 'page', function(e) {
          handlePageEvent(model, e.page);
        });

        getPagedData(model, 0);
      }
    });
  }

  return {
    render: render
  };
});
