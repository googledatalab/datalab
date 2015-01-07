// charting.js
//

require.config({
  paths: {
    topojson: '//cdnjs.cloudflare.com/ajax/libs/topojson/1.6.9/topojson.min',
    vega: '//cdnjs.cloudflare.com/ajax/libs/vega/1.4.3/vega'
  }
});

define(['vega'], function(vega) {
  function renderChart(dom, chartSpec) {
    var names = chartSpec.data.map(function(data) { return data.name; });
    IPython.notebook.kernel.get_values(names, function(values, error) {
      if (error) {
        return;
      }

      vega.parse.spec(chartSpec, function(chart) {
        var viewOptions = {
          el: dom,
          renderer: 'svg',
          data: values
        };
        var updateOptions = {
          duration: 250,
          ease: 'bounce-in'
        };
        chart(viewOptions).update(updateOptions);
      });
    });
  }

  return {
    render: renderChart
  };
});
