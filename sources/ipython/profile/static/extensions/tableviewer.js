// Basic table viewer helper for BigQuery tables.

define(function() {
    return {
        make_table_viewer: function (table_name, id, job_id) {
            var elt = document.getElementById("table_" + id);
            if (elt == undefined) {
                console.log("NO DIV!");
                return;
            }
            elt.model = {
                'page': 1,
                'total_rows': 0,
                'rows_per_page': 10,
                'labels': [],
                'data': []
            }

            var page_id = "page_" + id;
            var rows_per_page_id = "rpp_" + id;
            var count_id = "count_" + id;
            var head_id = "head_" + id;
            var body_id = "body_" + id;

            var first = true;

            var format = function () {
                var s = arguments[0];
                for (var i = 1; i < arguments.length; i++) {
                    var re = new RegExp("\\{" + (i - 1) + "\\}", "gm");
                    s = s.replace(re, arguments[i]);
                }
                return s;
            }

            // Construct the skeleton HTML on first callback.
            var construct = function (model) {

                var html = format(
                    '<div>' +
                    '  <div style="display:inline;float:left">' +
                    model.total_rows + ' rows' +
                    '  </div>' +
                    '  <div style="display:inline;float:right">' +
                    (job_id ? ('Job: ' + job_id) : table_name) +
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
                    '      <tr>', page_id, count_id, rows_per_page_id, head_id);

                html += '<td style="background-color:LightGray"><b>Row</b></td>';
                for (var c = 0; c < model.labels.length; c++) {
                    html += '<td style="background-color:LightGray"><b>' + model.labels[c] + '</b></td>';
                }

                html += format(
                    '      </tr>' +
                    '    </thead>' +
                    '    <tbody id="{0}" style="display:table-row-group;vertical-align:middle;border-collapse:collapse"/>' +
                    '  </table>' +
                    '</div>', body_id);

                elt.innerHTML = html;

                document.getElementById(page_id).addEventListener('input', function () {
                    var model = elt.model;
                    if (this.value >= 1 && this.value <= model.total_rows) {
                        model.page = this.value;
                        requestPageUpdate(model);
                    }
                });

                document.getElementById(rows_per_page_id).addEventListener('change', function () {
                    var model = elt.model;
                    var offset = (model.page - 1) * model.rows_per_page;
                    model.rows_per_page = parseInt(this.value);
                    model.page = 1 + Math.floor(offset / model.rows_per_page);
                    requestPageUpdate(model);
                });
                document.getElementById(rows_per_page_id).value = "10";
            }

            // Update dynamic content.
            var update = function (model) {
                elt.model = model;

                if (first) {
                    first = false;
                    construct(model);
                }

                var num_rows = model.rows_per_page;
                var num_pages = model.num_pages =
                    Math.floor((model.total_rows + num_rows - 1) / num_rows);
                var start_row = (model.page - 1) * model.rows_per_page;
                var rows_left = model.total_rows - start_row;
                if (num_rows > rows_left) {
                    num_rows = rows_left;
                }

                var html = "";
                for (var i = 0; i < num_rows; i++) {
                    html += "<tr style='display:table-row'>";
                    html += "<td style='background-color:WhiteSmoke'>" + (start_row + i) + "</td>";
                    for (var c = 0; c < model.labels.length; c++) {
                        html += "<td>" + model.data[i][c] + "</td>";
                    }
                    html += "</tr>";
                }

                document.getElementById(body_id).innerHTML = html;
                document.getElementById(page_id).value = model.page;
                document.getElementById(page_id).max = num_pages;
                document.getElementById(count_id).textContent = num_pages;
            }

            var requestPageUpdate = function (model) {
                var code = '%_get_table_page ' + id + ' ' + table_name + ' ' + model.page + ' '
                    + model.rows_per_page;
                IPython.notebook.kernel.get_data(code, function (data, error) {
                    if (error) {
                        elt.innerHTML = 'Unable to render the table. ' +
                        'The data being displayed could not be retrieved: ' + error;
                    } else {
                        update(data);
                    }
                });
            }

            // Notify the Python object so we get the first page.
            requestPageUpdate(elt.model);
        }
    };
});

