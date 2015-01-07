// Charting.js
//

require.config({
  paths: {
    visualization: '/static/content/require/visualization'
  }
});

define(function() {

  var chartMap = {
    area: { name: 'AreaChart' },
    columns: { name: 'ColumnChart' },
    bars: { name: 'BarChart' },
    histogram: { name: 'Histogram' },
    line: { name: 'LineChart' },
    pie: { name: 'PieChart' },
    scatter: { name: 'ScatterChart' },
    table: { script: 'table', name: 'Table' }
  };

  function renderChart(dom, chartType, dataName, options) {
    var chartInfo = chartMap[chartType];
    var chartScript = chartInfo.script || 'corechart';

    require(['visualization!' + chartScript], function(visualization) {
      var code = '%_chartTable ' + dataName;

      IPython.notebook.kernel.get_data(code, function(data, error) {
        if (error) {
          dom.innerHTML = 'Unable to render the chart. ' +
                          'The data being charted could not be retrieved.'
        }
        else {
          var chartData = new visualization.DataTable(data);
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
