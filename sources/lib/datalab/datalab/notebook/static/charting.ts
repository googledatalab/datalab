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

/// <reference path="../../../../../../externs/ts/require/require.d.ts" />

module Charting {
  declare var IPython:any;
  declare var datalab:any;

// Wrappers for Plotly.js and Google Charts

  abstract class ChartLibraryDriver {

    chartModule:any;

    constructor(protected dom:HTMLElement, protected chartStyle:string) {
    }

    abstract requires(url: string, chartStyle:string):Array<string>;

    init(chartModule:any):void {
      this.chartModule = chartModule;
    }

    abstract draw(data:any, options:any):void;

    abstract getStaticImage(callback:Function):void;

    abstract addChartReadyHandler(handler:Function):void;

    addPageChangedHandler(handler:Function):void {
    }

    error(message:string):void {
    }
  }

  class PlotlyDriver extends ChartLibraryDriver {
    readyHandler:any;

    constructor(dom:HTMLElement, chartStyle:string) {
      super(dom, chartStyle)
    }

    requires(url: string, chartStyle:string):Array<string> {
      return ['d3', 'plotly'];
    }

    public draw(data:any, options:any):void {
      /*
       * TODO(gram): if we start moving more chart types over to Plotly.js we should change the
       * shape of the data we pass to render so we don't need to reshape it here. Also, a fair
       * amount of the computation done here could be moved to Python code. We should just be
       * passing in the mostly complete layout object in JSON, for example.
       */
      var xlabels: Array<string> = [];
      var points: Array<any> = [];
      var layout: any = {
        xaxis: {},
        yaxis: {},
        height: 300,
        margin: {
          b: 60,
          t: 60,
          l: 60,
          r: 60
        }
      };
      if (options.title) {
        layout.title = options.title;
      }
      var minX: number = undefined;
      var maxX: number = undefined;
      if ('hAxis' in options) {
        if ('minValue' in options.hAxis) {
          minX = options.hAxis.minValue;
        }
        if ('maxValue' in options.hAxis) {
          maxX = options.hAxis.maxValue;
        }
        if (minX != undefined || maxX != undefined) {
          layout.xaxis.range = [minX, maxX];
        }
      }
      var minY: number = undefined;
      var maxY: number = undefined;
      if ('vAxis' in options) {
        if ('minValue' in options.vAxis) {
          minY = options.vAxis.minValue;
        } else if ('minValues' in options.vAxis) {
          minY = options.vAxis.minValues[0];
        }
        if ('maxValue' in options.vAxis) {
          maxY = options.vAxis.maxValue;
        } else if ('maxValues' in options.vAxis) {
          maxY = options.vAxis.maxValues[0];
        }
        if (minY != undefined || maxY != undefined) {
          layout.yaxis.range = [minY, maxY];
        }
        if ('minValues' in options.vAxis) {
          minY = options.vAxis.minValues[1]; // for second axis below
        }
        if ('maxValues' in options.vAxis) {
          maxY = options.vAxis.maxValues[1]; // for second axis below
        }
      }
      if (options.xAxisTitle) {
        layout.xaxis.title = options.xAxisTitle;
      }
      if (options.xAxisSide) {
        layout.xaxis.side = options.xAxisSide;
      }
      if (options.yAxisTitle) {
        layout.yaxis.title = options.yAxisTitle;
      }
      if (options.yAxesTitles) {
        layout.yaxis.title = options.yAxesTitles[0];
        layout.yaxis2 = {
          title: options.yAxesTitles[1],
          side: 'right',
          overlaying: 'y'
        };
        if (minY != undefined || maxY != undefined) {
          layout.yaxis2.range = [minY, maxY];
        }
      }
      if ('width' in options) {
        layout.width = options.width;
      }
      if ('height' in options) {
        layout.height = options.height;
        if ('width' in options) {
          layout.autosize = false;
        }
      }
      var pdata: Array<any> = [];

      if (this.chartStyle == 'line' || this.chartStyle == 'scatter') {
        var hoverCol: number = 0;
        var x: Array<any> = [];
        // First col is X, other cols are Y's and optional hover text only column
        var y: Array<any> = [];
        var hover: Array<any> = [];
        for (var c = 1; c < data.cols.length; c++) {
          x[c - 1] = [];
          y[c - 1] = [];
          var line:any = {
            x: x[c - 1],
            y: y[c - 1],
            name: data.cols[c].label,
            type: 'scatter',
            mode: this.chartStyle == 'scatter' ? 'markers' : 'lines'
          };
          if (options.hoverOnly) {
            hover[c - 1] = [];
            line.text = hover[c - 1];
            line.hoverinfo = 'text';
          }
          if (options.yAxesTitles && (c % 2) == 0) {
            line.yaxis = 'y2';
          }
          pdata.push(line);
        }
        for (var c = 1; c < data.cols.length; c++) {
          if (c == hoverCol) {
            continue;
          }
          for (var r = 0; r < data.rows.length; r++) {
            var entry:Array<any> = data.rows[r].c;
            if ('v' in entry[c]) {
              var xVal = entry[0].v;
              var yVal = entry[c].v;
              if (options.hoverOnly) {
                // Each column is a dict with two values, one for y and one for
                // hover. Extract these.
                var hoverVal:any;
                var yDict:any  = yVal;
                for (var prop in yDict) {
                  var val = yDict[prop];
                  if (prop == options.hoverOnly) {
                    hoverVal = val;
                  } else {
                    yVal = val;
                  }
                }
                // TODO(gram): we may want to add explicit hover text this even without hoverOnly.
                var xlabel:any = options.xAxisTitle || data.cols[0].label;
                var ylabel:any  = options.yAxisTitle || data.cols[c].label;
                var prefix = '';
                if (options.yAxisTitle) {
                  prefix += data.cols[c].label + ': ';
                }
                hover[c - 1].push(prefix +
                    options.hoverOnly + '=' + hoverVal + ', ' +
                    xlabel + '=' + xVal + ', ' +
                    ylabel + '=' + yVal);
              }
              x[c - 1].push(xVal);
              y[c - 1].push(yVal);
            }
          }
        }
      } else if (this.chartStyle == 'heatmap') {
        var size:number = 200 + data.cols.length * 50;
        if (size > 800) size = 800;
        layout.height = size;
        layout.width = size;
        layout.autosize = false;

        for (var i = 0; i < data.cols.length; i++) {
          xlabels[i] = data.cols[i].label;
        }
        var ylabels = [].concat(xlabels);

        // Plotly draws the first row at the bottom, not the top, so we need
        // to reverse the y and z array ordering.
        // We will need to tweak this a bit if we later support non-square maps.
        ylabels.reverse();

        var hovertext: Array<Array<string>> = [];
        var hoverx:string = options.xAxisTitle || 'x';
        var hovery = options.yAxisTitle || 'y';

        for (var i = 0; i < data.rows.length; i++) {
          var entry:Array<any> = data.rows[i].c;
          var row:Array<number> = [];
          var hoverrow:Array<string> = [];
          for (var j = 0; j < data.cols.length; j++) {
            row[j] = entry[j].v;
            hoverrow[j] = hoverx + '= ' + xlabels[j] + ', ' + hovery + '= ' +
                ylabels[i] + ': ' + row[j];
          }
          points[i] = row;
          hovertext[i] = hoverrow;
        }
        points.reverse();
        layout.hovermode = 'closest';

        pdata = [{
          x: xlabels,
          y: ylabels,
          z: points,
          type: 'heatmap',
          text: hovertext,
          hoverinfo: 'text'
        }];
        if (options.colorScale) {
          pdata[0].colorscale = [
            [0, options.colorScale.min],
            [1, options.colorScale.max]
          ];
        } else {
          pdata[0].colorscale = [
            [0, 'red'],
            [0.5, 'gray'],
            [1, 'blue']
          ];
        }
        if (options.hideScale) {
          pdata[0].showscale = false;
        }
        if (options.annotate) {
          layout.annotations = [];
          for (var i = 0; i < pdata[0].y.length; i++) {
            for (var j = 0; j < pdata[0].x.length; j++) {
              var currentValue = pdata[0].z[i][j];
              var textColor = (currentValue == 0.0) ? 'black' : 'white';
              var result = {
                xref: 'x1',
                yref: 'y1',
                x: pdata[0].x[j],
                y: pdata[0].y[i],
                text: pdata[0].z[i][j].toPrecision(3),
                showarrow: false,
                font: {
                  color: textColor
                }
              };
              layout.annotations.push(result);
            }
          }
        }
      }
      this.chartModule.newPlot(this.dom.id, pdata, layout, {displayModeBar: false});
      if (this.readyHandler) {
        this.readyHandler();
      }
    }

    getStaticImage(callback:Function):void {
      this.chartModule.Snapshot.toImage(document.getElementById(this.dom.id),
          {format: 'png'}).once('success', function (url:string) {
        callback(this.model, url);
      });
    }

    addChartReadyHandler(handler:Function):void {
      this.readyHandler = handler;
    }
  }

  interface IStringMap {
    [key: string]: string;
  }

  class GChartsDriver extends ChartLibraryDriver {

    chart:any;

    nameMap: IStringMap = {
      annotation: 'AnnotationChart',
      area: 'AreaChart',
      columns: 'ColumnChart',
      bars: 'BarChart',
      bubbles: 'BubbleChart',
      calendar: 'Calendar',
      candlestick: 'CandlestickChart',
      combo: 'ComboChart',
      gauge: 'Gauge',
      geo: 'GeoChart',
      histogram: 'Histogram',
      line: 'LineChart',
      map: 'Map',
      org: 'OrgChart',
      paged_table: 'Table',
      pie: 'PieChart',
      sankey: 'Sankey',
      scatter: 'ScatterChart',
      stepped_area: 'SteppedAreaChart',
      table: 'Table',
      timeline: 'Timeline',
      treemap: 'TreeMap',
    };

    scriptMap: IStringMap = {
      annotation: 'annotationchart',
      calendar: 'calendar',
      gauge: 'gauge',
      geo: 'geochart',
      map: 'map',
      org: 'orgchart',
      paged_table: 'table',
      sankey: 'sankey',
      table: 'table',
      timeline: 'timeline',
      treemap: 'treemap'
    };

    constructor(dom:HTMLElement, chartStyle:string) {
      super(dom, chartStyle);
    }

    requires(url: string, chartStyle:string):Array<string> {
      var chartScript:string = 'corechart';
      if (chartStyle in this.scriptMap) {
        chartScript = this.scriptMap[chartStyle];
      }
      return [url + 'visualization!' + chartScript];
    }

    init(chartModule:any):void {
      super.init(chartModule);
      var constructor:Function = this.chartModule[this.nameMap[this.chartStyle]];
      this.chart = new (<any>constructor)(this.dom);
    }

    error(message:string):void {
      this.chartModule.errors.addError(this.dom, 'Unable to render the chart', message,
          {showInTooltip: false});
    }

    draw(data:any, options:any):void {
      console.log('Drawing with options ' + JSON.stringify(options));
      this.chart.draw(new this.chartModule.DataTable(data), options);
    }

    getStaticImage(callback:Function):void {
      if (this.chart.getImageURI) {
        callback(this.chart.getImageURI());
      }
    }

    addChartReadyHandler(handler:Function) {
      this.chartModule.events.addListener(this.chart, 'ready', handler);
    }

    addPageChangedHandler(handler:Function) {
      this.chartModule.events.addListener(this.chart, 'page', function (e:any) {
        handler(e.page);
      });
    }
  }

  class Chart {
    dataCache:any;  // TODO: add interface types for the caches.
    optionsCache:any;
    hasIPython:boolean;
    cellElement:HTMLElement;
    totalRows:number;

    constructor(protected driver:ChartLibraryDriver,
                protected dom:Element,
                protected controlIds:Array<string>,
                protected base_options:any,
                protected refreshData:any,
                protected refreshInterval:number,
                totalRows:number) {
      this.totalRows = totalRows || -1; // Total rows in all (server-side) data.
      this.dataCache = {};
      this.optionsCache = {};
      this.hasIPython = false;
      try {
        if (IPython) {
          this.hasIPython = true;
        }
      } catch (e) {
      }
      (<HTMLElement>this.dom).innerHTML = '';
      this.removeStaticChart();
      this.addControls();
      // Generate and add a new static chart once chart is ready.
      var _this = this;
      this.driver.addChartReadyHandler(function () {
        _this.addStaticChart();
      });
    }

    // Convert any string fields that are date type to JS Dates.
    public static convertDates(data:any):void {
      for (var i = 0; i < data.cols.length; i++) {
        if (data.cols[i].type == 'datetime') {
          var rows = data.rows;
          for (var j = 0; j < rows.length; j++) {
            rows[j].c[i].v = new Date(rows[j].c[i].v);
          }
        }
      }
    }

    // Extend the properties in a 'base' object with the changes in an 'update' object.
    // We can add properties or override properties but not delete yet.
    private static extend(base:any, update:any):void {
      for (var p in update) {
        if (typeof base[p] !== 'object' || !base.hasOwnProperty(p)) {
          base[p] = update[p];
        } else {
          this.extend(base[p], update[p]);
        }
      }
    }

    // Get the IPython cell associated with this chart.
    private getCell() {
      if (!this.hasIPython) {
        return undefined;
      }
      var cells = IPython.notebook.get_cells();
      for (var cellIndex in cells) {
        var cell = cells[cellIndex];
        if (cell.element && cell.element.length) {
          var element = cell.element[0];
          var chartDivs = element.getElementsByClassName('bqgc');
          if (chartDivs && chartDivs.length) {
            for (var i = 0; i < chartDivs.length; i++) {
              if (chartDivs[i].id == this.dom.id) {
                return cell;
              }
            }
          }
        }
      }
      return undefined;
    }

    protected getRefreshHandler(useCache:boolean):Function {
      var _this = this;
      return function () {
        _this.refresh(useCache);
      };
    }

    // Bind event handlers to the chart controls, if any.
    private addControls():void {
      if (!this.controlIds) {
        return;
      }
      var controlHandler = this.getRefreshHandler(true);
      for (var i = 0; i < this.controlIds.length; i++) {
        var id = this.controlIds[i];
        var split = id.indexOf(':');
        var control:HTMLInputElement;
        if (split >= 0) {
          // Checkbox group.
          var count = parseInt(id.substring(split + 1));
          var base = id.substring(0, split + 1);
          for (var j = 0; j < count; j++) {
            control = <HTMLInputElement>document.getElementById(base + j);
            control.disabled = !this.hasIPython;
            control.addEventListener('change', function() {
              controlHandler();
            });
          }
          continue;
        }
        // See if we have an associated control that needs dual binding.
        control = <HTMLInputElement>document.getElementById(id);
        if (!control) {
          // Kernel restart?
          return;
        }
        control.disabled = !this.hasIPython;
        var textControl = <HTMLInputElement>document.getElementById(id + '_value');
        if (textControl) {
          textControl.disabled = !this.hasIPython;
          textControl.addEventListener('change', function () {
            if (control.value != textControl.value) {
              control.value = textControl.value;
              controlHandler();
            }
          });
          control.addEventListener('change', function () {
            textControl.value = control.value;
            controlHandler();
          });
        } else {
          control.addEventListener('change', function() {
            controlHandler();
          });
        }
      }
    }

    // Iterate through any widget controls and build up a JSON representation
    // of their values that can be passed to the Python kernel as part of the
    // magic to fetch data (also used as part of the cache key).
    protected getControlSettings():any {
      var env:any = {};
      if (this.controlIds) {
        for (var i = 0; i < this.controlIds.length; i++) {
          var id = this.controlIds[i];
          var parts = id.split('__');
          var varName = parts[1];
          var splitPoint = varName.indexOf(':');
          if (splitPoint >= 0) { // this is a checkbox group
            var count = parseInt(varName.substring(splitPoint + 1));
            varName = varName.substring(0, splitPoint);
            var cbBaseId = parts[0] + '__' + varName + ':';
            var list:Array<string> = [];
            env[varName] = list;
            for (var j = 0; j < count; j++) {
              var cb = <HTMLInputElement>document.getElementById(cbBaseId + j);
              if (!cb) {
                // Stale refresh; user re-executed cell.
                return undefined;
              }
              if (cb.checked) {
                list.push(cb.value);
              }
            }
          } else {
            var e = <HTMLInputElement>document.getElementById(id);
            if (!e) {
              // Stale refresh; user re-executed cell.
              return undefined;
            }
            if (e && e.type == 'checkbox') {
              // boolean
              env[varName] = e.checked;
            } else {
              // picker/slider/text
              env[varName] = e.value;
            }
          }
        }
      }
      return env;
    }

    // Get a string representation of the current environment - i.e. control settings and
    // refresh data. This is used as a cache key.
    private getEnvironment():string {
      var controls:any = this.getControlSettings();
      if (controls == undefined) {
        // This means the user has re-executed the cell and our controls are gone.
        return undefined;
      }
      var env:any = {controls: controls};
      Chart.extend(env, this.refreshData);
      return JSON.stringify(env);
    }

    protected refresh(useCache:boolean):void {
      // TODO(gram): remember last cache key and don't redraw chart if cache
      // key is the same unless this is an ML key and the number of data points has changed.
      this.removeStaticChart();
      var env:string = this.getEnvironment();
      if (env == undefined) {
        // This means the user has re-executed the cell and our controls are gone.
        console.log('No chart control environment; abandoning refresh');
        return;
      }
      if (useCache && env in this.dataCache) {
        this.draw(this.dataCache[env], this.optionsCache[env]);
        return;
      }
      var code = '%_get_chart_data\n' + env;

      // TODO: hook into the notebook UI to enable/disable 'Running...' while we fetch more data.
      if (!this.cellElement) {
        var cell = this.getCell();
        if (cell && cell.element && cell.element.length == 1) {
          this.cellElement = cell.element[0];
        }
      }
      // Start the cell spinner in the notebook UI.
      if (this.cellElement) {
        this.cellElement.classList.remove('completed');
      }
      var _this = this;
      datalab.session.execute(code, function (error:string, response:any) {
        _this.handleNewData(env, error, response);
      });
    }

    private handleNewData(env: any, error:any, response: any) {
      var data = response.data;

      // Stop the cell spinner in the notebook UI.
      if (this.cellElement) {
        this.cellElement.classList.add('completed');
      }

      if (data == undefined || data.cols == undefined) {
        error = 'No data';
      }

      if (error) {
        this.driver.error(error);
        return;
      }

      this.refreshInterval = response.refresh_interval;
      if (this.refreshInterval == 0) {
        console.log('No more refreshes for ' + this.refreshData.name);
      }

      Chart.convertDates(data);
      var options = this.base_options;
      if (response.options) {
        // update any options. We need to make a copy so we don't break the base options.
        options = JSON.parse(JSON.stringify(options));
        Chart.extend(options, response.options);
      }

      // Don't update or keep refreshing this if control settings have changed.
      var newEnv = this.getEnvironment();
      if (env == newEnv) {
        console.log('Got refresh for ' + this.refreshData.name + ', ' + env);
        this.draw(data, options);
      } else {
        console.log('Stopping refresh for ' + env + ' as controls are now ' + newEnv)
      }
    }

    // Remove a static chart (PNG) from the notebook and the DOM.
    protected removeStaticChart():void {
      var cell = this.getCell();
      if (cell) {
        var pngDivs = <NodeListOf<HTMLDivElement>>
            cell.element[0].getElementsByClassName('output_png');
        if (pngDivs) {
          for (var i = 0; i < pngDivs.length; i++) {
            pngDivs[i].innerHTML = '';
          }
        }
        var cell_outputs = cell.output_area.outputs;
        var changed = true;
        while (changed) {
          changed = false;
          for (var outputIndex in cell_outputs) {
            var output = cell_outputs[outputIndex];
            if (output.output_type == 'display_data' && output.metadata.source_id == this.dom.id) {
              cell_outputs.splice(outputIndex, 1);
              changed = true;
              break;
            }
          }
        }
      } else {
        // Not running under IPython; use a different approach and just clear the DOM.
        // Iterate through the IPython outputs...
        var outputDivs = document.getElementsByClassName('output_wrapper');
        if (outputDivs) {
          for (var i = 0; i < outputDivs.length; i++) {
            // ...and any chart outputs in each...
            var outputDiv = <HTMLDivElement>outputDivs[i];
            var chartDivs = outputDiv.getElementsByClassName('bqgc');
            if (chartDivs) {
              for (var j = 0; j < chartDivs.length; j++) {
                // ...until we find the chart div ID we want...
                if (chartDivs[j].id == this.dom.id) {
                  // ...then get any PNG outputs in that same output group...
                  var pngDivs = <NodeListOf<HTMLDivElement>>outputDiv.
                      getElementsByClassName('output_png');
                  if (pngDivs) {
                    for (var k = 0; k < pngDivs.length; k++) {
                      // ... and clear their contents.
                      pngDivs[k].innerHTML = '';
                    }
                  }
                  return;
                }
              }
            }
          }
        }
      }
    }

    // Add a static chart (PNG) to the notebook. The notebook will in turn add it to the DOM when
    // the notebook is opened.
    private addStaticChart():void {
      var _this = this;
      this.driver.getStaticImage(function (img:string) {
        _this.handleStaticChart(img);
      });
    }

    private handleStaticChart(img: string) {
      if (img) {
        var cell = this.getCell();
        if (cell) {
          var encoding = img.substr(img.indexOf(',') + 1);  // strip leading base64 etc.
          var static_output = {
            metadata: {
              source_id: this.dom.id
            },
            data: {
              'image/png': encoding
            },
            output_type: 'display_data'
          };
          cell.output_area.outputs.push(static_output);
        }
      }
    }

    // Set up a refresh callback if we have a non-zero interval and the DOM element still exists
    // (i.e. output hasn't been cleared).
    private configureRefresh(refreshInterval:number):void {
      if (refreshInterval > 0 && document.getElementById(this.dom.id)) {
        window.setTimeout(this.getRefreshHandler(false), 1000 * refreshInterval);
      }
    }

    // Cache the current data and options and draw the chart.
    public draw(data:any, options:any):void {
      var env:string = this.getEnvironment();
      this.dataCache[env] = data;
      this.optionsCache[env] = options;
      if ('cols' in data) {
        this.driver.draw(data, options);
      }
      this.configureRefresh(this.refreshInterval);
    }
  }

  //-----------------------------------------------------------
  // A special version of Chart for supporting paginated data.

  class PagedTable extends Chart {
    firstRow:number;
    pageSize:number;

    constructor(driver:ChartLibraryDriver,
                dom:HTMLElement,
                controlIds:Array<string>,
                base_options:any,
                refreshData:any,
                refreshInterval:number,
                totalRows:number) {
      super(driver, dom, controlIds, base_options, refreshData, refreshInterval, totalRows);
      this.firstRow = 0;  // Index of first row being displayed in page.
      this.pageSize = base_options.pageSize || 25;
      if (this.base_options.showRowNumber == undefined) {
        this.base_options.showRowNumber = true;
      }
      this.base_options.sort = 'disable';
      var _this = this;
      this.driver.addPageChangedHandler(function (page:number) {
        _this.handlePageEvent(page);
      });
    }

    // Get control settings for cache key. For paged table we add the first row offset of the table.
    protected getControlSettings():any {
      var env = super.getControlSettings();
      if (env) {
        env.first = this.firstRow;
      }
      return env;
    }

    public draw(data:any, options:any):void {
      var count = this.pageSize;
      options.firstRowNumber = this.firstRow + 1;
      options.page = 'event';
      if (this.totalRows < 0) {
        // We don't know where the end is, so we should have 'next' button.
        options.pagingButtonsConfiguration = this.firstRow > 0 ? 'both' : 'next';
      } else {
        count = this.totalRows - this.firstRow;
        if (count > this.pageSize) {
          count = this.pageSize;
        }
        if (this.firstRow + count < this.totalRows) {
          // We are not on last page, so we should have 'next' button.
          options.pagingButtonsConfiguration = this.firstRow > 0 ? 'both' : 'next';
        } else {
          // We are on last page
          if (this.firstRow == 0) {
            options.pagingButtonsConfiguration = 'none';
            options.page = 'disable';
          } else {
            options.pagingButtonsConfiguration = 'prev';
          }
        }
      }
      super.draw(data, options);
    }

    // Handle page forward/back events. Page will only be 0 or 1.
    handlePageEvent(page:number):void {
      var offset = (page == 0) ? -1 : 1;
      this.firstRow += offset * this.pageSize;
      this.refresh(true);
    }
  }

  function convertListToDataTable(data:any):any {
    if (!data || !data.length) {
      return {cols: [], rows: []};
    }

    var firstItem = data[0];
    var names = Object.keys(firstItem);

    var columns = names.map(function (name) {
      return {id: name, label: name, type: typeof firstItem[name]}
    });

    var rows = data.map(function (item:any) {
      var cells = names.map(function (name) {
        return {v: item[name]};
      });
      return {c: cells};
    });

    return {cols: columns, rows: rows};
  }

  // The main render method, called from render() wrapper below. dom is the DOM element
  // for the chart, model is a set of parameters from Python, and options is a JSON
  // set of options provided by the user in the cell magic body, which takes precedence over
  // model. An initial set of data can be passed in as a final optional parameter.

  function _render(driver:ChartLibraryDriver,
                   dom:HTMLElement,
                   chartStyle:string,
                   controlIds:Array<string>,
                   data:any,
                   options:any,
                   refreshData:any,
                   refreshInterval:number,
                   totalRows:number):void {
    require(["base/js/namespace"], function(Jupyter: any) {
      var url = "datalab/";
      require(driver.requires(url, chartStyle), function (/* ... */) {
        // chart module should be last dependency in require() call...
        var chartModule = arguments[arguments.length - 1];  // See if it needs to be a member.
        driver.init(chartModule);
        options = options || {};

        var chart:Chart;
        if (chartStyle == 'paged_table') {
          chart = new PagedTable(driver, dom, controlIds, options, refreshData, refreshInterval, totalRows);
        } else {
          chart = new Chart(driver, dom, controlIds, options, refreshData, refreshInterval, totalRows);
        }
        Chart.convertDates(data);
        chart.draw(data, options);
        // Do we need to do anything to prevent it getting GCed?
      });
    });
  }

  export function render(driverName:string,
                         dom:HTMLElement,
                         events:any,
                         chartStyle:string,
                         controlIds:Array<string>,
                         data:any,
                         options:any,
                         refreshData:any,
                         refreshInterval:number,
                         totalRows:number):void {

    // If this is HTML from nbconvert we can't support paging so add some text making this clear.
    if (chartStyle == 'paged_table' && document.hasOwnProperty('_in_nbconverted')) {
      chartStyle = 'table';
      var p = document.createElement("div");
      p.innerHTML = '<br>(Truncated to first page of results)';
      dom.parentNode.insertBefore(p, dom.nextSibling);
    }

    // Allocate an appropriate driver.
    var driver:ChartLibraryDriver;
    if (driverName == 'plotly') {
      driver = new PlotlyDriver(dom, chartStyle);
    } else if (driverName == 'gcharts') {
      driver = new GChartsDriver(dom, chartStyle);
    } else {
      throw new Error('Unsupported chart driver ' + driverName);
    }

    // Get data in form needed for GCharts.
    // We shouldn't need this; should be handled by caller.
    if (!data.cols && !data.rows) {
      data = this.convertListToDataTable(data);
    }

    // If we have a datalab session, we can go ahead and draw the chart; if not, add code to do the
    // drawing to an event handler for when the kernel is ready.
    if (IPython.notebook.kernel.is_connected()) {
      _render(driver, dom, chartStyle, controlIds, data, options, refreshData, refreshInterval,
          totalRows)
    } else {
      // If the kernel is not connected, wait for the event.
      events.on('kernel_ready.Kernel', function (e:any) {
        _render(driver, dom, chartStyle, controlIds, data, options, refreshData, refreshInterval,
            totalRows)
      });
    }
  }
}

export = Charting;


