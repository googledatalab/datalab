// Basic table viewer helper for BigQuery tables.

define(function() {
    return {
        makeTableViewer: function (tableName, id, labels, totalRows, jobId) {
            var elt = document.getElementById("table_" + id);
            if (elt == undefined) {
                console.log("NO DIV!");
                return;
            }
            var model = {
                "firstRow": 0,
                "displayPage": 1,
                "rowsPerPage": 10,
                'data': []
            }

            var pageId = "page_" + id;
            var rowsPerPageId = "rpp_" + id;
            var countId = "count_" + id;
            var headId = "head_" + id;
            var bodyId = "body_" + id;

            function format() {
                var s = arguments[0];
                for (var i = 1; i < arguments.length; i++) {
                    var re = new RegExp("\\{" + (i - 1) + "\\}", "gm");
                    s = s.replace(re, arguments[i]);
                }
                return s;
            }

            var html = format(
                '<div>' +
                '  <div style="display:inline;float:left">' + totalRows + ' rows</div>' +
                '  <div style="display:inline;float:right">' +
                (jobId ? ('Job: ' + jobId) : tableName) +
                '  </div>' +
                '</div>' +
                '<br>' +
                '<div>' +
                '  <div style="display:inline;float:left">' +
                '    <span style="vertical-align:super">Page </span>' +
                '    <input type="number" min=1 id="{0}" style="width:120px">' +
                '    <span style="vertical-align:super"> of </span>' +
                '    <span style="vertical-align:super" id="{1}"></span>' +
                '  </div>' +
                '  <div style="display:inline;float:right">' +
                '    <span style="vertical-align:super">Rows per Page </span>' +
                '    <select id="{2}" style="width:80px">' +
                '      <option value="10">10</option>' +
                '      <option value="20">20</option>' +
                '      <option value="50">50</option>' +
                '      <option value="100">100</option>' +
                '    </select>' +
                '  </div>' +
                '</div>' +
                '<div style="overflow:auto;width:100%">' +
                '  <table border="1" cellpadding="3" cellspacing="0" style="border:1px solid black;border-collapse:collapse">' +
                '    <thead id="{3}" style="display:table-row-group;vertical-align:middle;border-collapse:collapse">' +
                '      <tr>', pageId, countId, rowsPerPageId, headId);

            html += '<td style="background-color:LightGray"><b>Row</b></td>';
            for (var c = 0; c < labels.length; c++) {
                html += '<td style="background-color:LightGray"><b>' + labels[c] + '</b></td>';
            }

            html += format(
                '      </tr>' +
                '    </thead>' +
                '    <tbody id="{0}" style="display:table-row-group;vertical-align:middle;border-collapse:collapse"/>' +
                '  </table>' +
                '</div>', bodyId);

            elt.innerHTML = html;

            document.getElementById(pageId).addEventListener('input', function () {
                if (this.value >= 1 && this.value <= totalRows) {
                    model.displayPage = this.value;
                    requestPageUpdate();
                }
            });

            document.getElementById(rowsPerPageId).addEventListener('change', function () {
                var offset = (model.displayPage - 1) * model.rowsPerPage;
                model.rowsPerPage = parseInt(this.value);
                model.displayPage = 1 + Math.floor(offset / model.rowsPerPage);
                requestPageUpdate();
            });
            document.getElementById(rowsPerPageId).value = "10";

            // Update dynamic content.
            function update(data) {
                model.data = data;

                var numRows = model.rowsPerPage;
                var numPages = model.num_pages = Math.ceil(totalRows / numRows);
                var startRow = (model.displayPage - 1) * model.rowsPerPage;
                var rowsLeft = totalRows - startRow;
                if (numRows > rowsLeft) {
                    numRows = rowsLeft;
                }
                var offset = (model.displayPage - 1) * model.rowsPerPage - model.firstRow;

                var html = "";
                for (var i = 0; i < numRows; i++) {
                    html += "<tr style='display:table-row'>";
                    html += "<td style='background-color:WhiteSmoke'>" + (startRow + i) + "</td>";
                    for (var c = 0; c < labels.length; c++) {
                        html += "<td>" + model.data[offset + i][labels[c]] + "</td>";
                    }
                    html += "</tr>";
                }

                document.getElementById(bodyId).innerHTML = html;
                document.getElementById(pageId).value = model.displayPage;
                document.getElementById(pageId).max = numPages;
                document.getElementById(countId).textContent = numPages;
            }

            function requestPageUpdate() {
                // See if we need to fetch more data
                var first = (model.displayPage - 1) * model.rowsPerPage;
                var last = first + model.rowsPerPage;
                if (first >= model.firstRow && last < (model.firstRow + model.data.length)) {
                    update(model.data);
                } else {
                    // Fetch more data. We try to fetch data surrounding the display page so the
                    // user can go forward or back through locally cached data. However, if the
                    // total amount of data is less than 1500 rows, ignore that and fetch it all
                    // (this would be a first load).
                    var count = 1000;
                    if (totalRows <= 1500) { // We have less than 1500; fetch them all
                        model.firstRow = 0;
                        count = totalRows;
                    } else if (totalRows - first < 500) { // We are near the end; fetch last 1000
                        model.firstRow = totalRows - 1000;
                    } else {
                        // fetch surrounding
                        model.firstRow = first - 500 - model.rowsPerPage;
                        if (model.firstRow < 0) {
                            model.firstRow = 0;
                        }
                    }
                    var code = '%_get_table_rows ' + tableName + ' ' + model.firstRow +
                        ' ' + count;
                    IPython.notebook.kernel.get_data(code, function (data, error) {
                        if (error) {
                            elt.innerHTML = 'Unable to render the table. ' +
                            'The data being displayed could not be retrieved: ' + error;
                        } else {
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

