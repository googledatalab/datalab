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
    table: {script: 'table', name: 'Table'}
  };

  function renderChart(dom, chartType, dataName, options, fields) {
    var chartInfo = chartMap[chartType];
    var chartScript = chartInfo.script || 'corechart';
    fields = fields || '';

    require(['visualization!' + chartScript], function (visualization) {
      var code = '%_get_chart_data ' + dataName + ' ' + fields

      IPython.notebook.kernel.get_data(code, function (data, error) {
        if (error) {
          dom.innerHTML = 'Unable to render the chart. ' +
          'The data being charted could not be retrieved.' + error.toString();
        }
        else {
          var chartData = new visualization.DataTable(data['data']);
          var chartType = visualization[chartInfo.name];

          var chart = new chartType(dom);
          chart.draw(chartData, options);
        }
      });
    });
  }

  return {
    render: renderChart
  };
});
