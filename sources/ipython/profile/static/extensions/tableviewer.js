// Basic table viewer helper for BigQuery tables.

define(['d3', 'crossfilter', 'dc'], function (d3, crossfilter, dc) {
  return {
    makeTableViewer: function (tableName, tableView, labels, data, totalRows, rowsPerPage, jobId) {
      if (tableView == undefined) {
        console.log("NO DIV!");
        return;
      }
      var model = {
        "firstRow": 0,
        "displayPage": 1,
        'data': data
      }

      if (data != undefined) {
        if (totalRows == undefined) {
          totalRows = data.length;
        }
        // Add the row field; needed for crossfilter, as a unique dimension.
        // TODO(gram): if we change the table so it no longer needs crossfilter we can
        // get rid of adding Rows to the labels and data.
        addRows(data);
      }
      if (rowsPerPage == undefined) {
        rowsPerPage = 25;
      }
      if (jobId == undefined) {
        jobId = '';
      }

      var viewerDiv = document.createElement('div');
      var widget = d3.select(viewerDiv);

      var metaDataDiv = widget.append('div');
      if (totalRows >= 0) {
        metaDataDiv.append('div')
            .attr('class', 'bqtv-meta-left')
            .text(totalRows + ' rows');
      }
      metaDataDiv.append('div').attr('class', 'bqtv-meta-right')
          .text(jobId.length ? ('Job: ' + jobId) : tableName);

      widget.append('br');

      var naviDiv = widget.append('div');

      var naviLeft = naviDiv.append('div').attr('class', 'bqtv-meta-left');
      naviLeft.append('span').attr('class', 'bqtv-meta-text').text('Page ');
      var pageInput = naviLeft.append('input')
          .attr('type', 'number')
          .attr('min', '1')
          .attr('value', '1')
          .attr('class', 'bqtv-page-input')
          .on('input', function () {
            if (this.value >= 1 && (totalRows < 0 || this.value <= totalRows)) {
              model.displayPage = this.value;
              requestPageUpdate();
            }
          });
      if (totalRows >= 0) {
        naviLeft.append('span').attr('class', 'bqtv-meta-text').text(' of ');
        var totalPagesSpan = naviLeft.append('span').attr('class', 'bqtv-meta-text');
      }

      var table = widget
          .append('div').attr('class', 'bqtv-table-div')
          .append('table').attr('class', 'bqtv-table');

      var tableLabelRow = table
          .append('thead').attr('class', 'dc-table-head')
          .append('tr');

      // ToT version of dc can add column headers but stable version doesn't, so for
      // now we have to do these ourselves.

      labels = ['Row'].concat(labels)
      for (var i = 0; i < labels.length; i++) {
        tableLabelRow.append('td').text(labels[i]);
      }

      tableView.appendChild(viewerDiv);

      function rowFunc(r) {
        return r.Row
      };

      // TODO(gram): ToT of DC allows us to pass in an array of strings
      // to the columns function, but the stable version right now doesn't
      // support that; it wants an array of functions, so create those.
      var columns = []
      for (var i = 0; i < labels.length; i++) {
        columns.push(function (label) {
          return function (r) {
            return r[label];
          };
        }(labels[i]));
      }

      var datatable = null;
      var xdata = null;
      var rowDimension = null;

      function addRows(data) {
        // Add row index to data
        for (var i = 0; i < data.length; i++) {
          data[i].Row = model.firstRow + i + 1;
        }
      }

      // Update dynamic content.
      function update(data) {
        var numRows = rowsPerPage;
        var startRow = (model.displayPage - 1) * rowsPerPage;
        var numPages = -1;
        if (totalRows >= 0) {
          numPages = model.num_pages = Math.ceil(totalRows / numRows);
          var rowsLeft = totalRows - startRow;
          if (numRows > rowsLeft) {
            numRows = rowsLeft;
          }
        }

        if (xdata == null) {
          // First time
          xdata = crossfilter(data);
          rowDimension = xdata.dimension(rowFunc)
        } else if (model.data != data) {
          // Replace the data in the crossfilter.
          rowDimension.filter(null);
          xdata.remove();
          xdata.add(data);
          model.data = data;
        }

        // Filter to the current page in view
        rowDimension.filterRange([startRow + 1, startRow + numRows + 1]);

        if (datatable == null) {
          // Add the table.
          datatable = dc.dataTable(table.node())
              .dimension(xdata.dimension(rowFunc))
              .size(rowsPerPage)
              .group(function () {
              })  // Mandatory even though we don't want groups.
              .columns(columns)
              .sortBy(rowFunc);
        }
        datatable.render();

        if (numPages >= 0) {
          pageInput.attr('max', numPages).attr('value', model.displayPage.toString());
          totalPagesSpan.text(numPages);
        }
      }

      function requestPageUpdate() {
        // See if we need to fetch more data
        var first = (model.displayPage - 1) * rowsPerPage;
        var last = first + rowsPerPage;
        if (last > totalRows) {
          last = totalRows - 1;
        }

        if (first >= model.firstRow && last < (model.firstRow + model.data.length)) {
          update(model.data);
        } else {
          // Fetch more data. We try to fetch data surrounding the display page so the
          // user can go forward or back through locally cached data. However, if the
          // total amount of data is less than 1500 rows, ignore that and fetch it all
          // (this would be a first load).
          var count = 1000;
          if (totalRows >= 0 && totalRows <= 1500) { // Less than 1500; fetch all.
            count = totalRows;
          }

          // Fetch rows surrounding <first> so we can move back/forward fast.
          model.firstRow = first - (count / 2) - rowsPerPage;

          if (totalRows >= 0 && model.firstRow > totalRows - count) {
            // We would fetch less than <count> so back up more.
            model.firstRow = totalRows - count;
          }

          if (model.firstRow < 0) {
            model.firstRow = 0;
          }
          var code = '%_get_table_rows ' + tableName + ' ' + model.firstRow +
              ' ' + count;
          IPython.notebook.kernel.get_data(code, function (data, error) {
            if (error) {
              tableView.innerHTML = 'Unable to render the table. ' +
              'The data being displayed could not be retrieved: ' + error;
            } else {
              addRows(data['data']);
              update(data['data']);
            }
          });
        }
      }

      // Notify the Python object so we get the first page.
      requestPageUpdate();
    }
  };
});

