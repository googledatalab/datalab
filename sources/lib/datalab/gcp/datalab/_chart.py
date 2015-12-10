# Copyright 2015 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
# in compliance with the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software distributed under the License
# is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
# or implied. See the License for the specific language governing permissions and limitations under
# the License.

"""Google Cloud Platform library - Chart cell magic."""

import argparse
import json
import IPython
import IPython.core
import IPython.core.display
import IPython.core.magic
import gcp._util
import _commands
import _html
import _utils


@IPython.core.magic.register_line_cell_magic
def chart(line, cell=None):
  """ Generate charts with Google Charts. Use %chart --help for more details. """
  # The lines below execeed the normal length as they are formatted for the Datalab help pane.
  parser = _commands.CommandParser(prog='%%chart', description="""
Generate an inline chart using Google Charts using the data in a Table, Query, dataframe, or list. Numerous types
of charts are supported. Options for the charts can be specified in the cell body using YAML or JSON. For details
on the options see the individual chart type descriptions at:

    https://google-developers.appspot.com/chart/interactive/docs/gallery.

The data should be specified with a --data argument and the fields to chart can be specified using an optional
--fields argument; the field names should be specified in a comma-separated list with no spaces (use quotes around
the whole argument if needed; i.e. if there are field names that contain whitespace). For example:

    %chart line --data myquery --fields Year,Count

The specified fields will be extracted from the data source and passed to Google Charts API. You should make sure
that the data being supplied meets any constraints on the data format for that chart type (chart data format
requirements are documented at the link above).

Use "%chart <charttype> --help" for further help on each chart type.
""", formatter_class=_utils.PagerHelpFormatter)
  for chart_type in _chart_data.keys():
    description = _chart_data[chart_type]['description']
    help = 'Generate a%s %s chart.' % ('n' if chart_type[0] in 'aeiou' else '', chart_type)
    subparser = parser.subcommand(chart_type, help, '%s\n\n%s' % (help, description),
                                  formatter=_utils.PagerHelpFormatter)
    subparser.add_argument('-f', '--fields',
                           help='The field(s) to include in the chart')
    subparser.add_argument('-d', '--data',
                           help='The name of the variable referencing the Table or Query to chart',
                           required=True)
    subparser.set_defaults(chart=chart_type)
    _utils.redirect_parser_help(subparser)

  parser.set_defaults(func=_chart_cell)
  _utils.redirect_parser_help(parser)
  return _utils.handle_magic_line(line, cell, parser)


class _ChartException(Exception):
  def __init__(self, chart_type, message):
    super(_ChartException, self).__init__("%s\n\nUse '%%chart %s --help' for more info\n" %
                                          (message, chart_type))


def _check_schema(chart_type, cols, min_cols, schema):
  if len(cols) < min_cols:
    raise _ChartException(chart_type, 'Expected at least %d columns' % min_cols)

  if len(cols) > len(schema) and schema[-1] != '*':
    raise _ChartException(chart_type, 'Expected at most %d columns' % len(schema))
  for i in range(0, len(cols)):
    t = cols[i]['type']
    s = schema[i if i < len(schema) else -1]
    if s == '*':
      s = schema[-2]

    if isinstance(s, list):
      if t not in s:
        raise _ChartException(chart_type, 'Expected column %d to have one of %s types but got %s' %
                              (i + 1, str(s), t))
    elif schema[i] != 'any' and s != t:
      raise _ChartException(chart_type, 'Expected column %d to have a %s type but got %s' %
                            (i + 1, s, t))


def _check_schemas(chart_type, cols, schemas):
  for i in range(0, len(schemas)):
    try:
      _check_schema(chart_type, cols, schemas[i]['min_cols'], schemas[i]['schema'])
      # If the check passed we are done
      return
    except Exception as e:
      if len(schemas) == 1:
        raise e
  raise Exception('Data does not match any expected formats.')

# Definition of data related to each chart type. This is a dictionary keyed on chart type,
# where each entry in turn is a dictionary with a string 'description' and a list 'schemas'.
# 'description' is used for help text while 'schemas' described the possible expected shape(s)
# of the data. Each entry in the 'schemas' list has a 'schema' list member, and a 'min_cols'
# integer member. The num_cols field specifies the minimum number of columns in the schema
# that should be present. The schema is a list of allowed field types for # each column; each
# member is either a chart scalar data type ('number', 'string', etc) or list
# of scalar types if variants are supported, plus the special value '*' which means the last
# column type can be repeated multiple times (so [3, 4, 5] satisfies ['number', '*']).
_chart_data = {
  'annotation': {
    'schemas': [
      {
        'min_cols': 1,
        'schema': ['datetime', 'string', 'string'],
      }
    ],
    'description': """
Annotation charts are interactive time series line charts that support annotations.

You can display one or more lines on your chart. Each row represents an X position on the chart - that is, a
specific time; each line is described by a set of one to three columns.

The first value should be a datetime, and specifies the x-value. One or two additional string columns can be
used to specify an annotation title and annotation text.
""",
    'area': {
      'schemas': [
        {
          'min_cols': 2,
          'schema': [['string', 'number'], 'number', '*'],
        }
      ],
      'description': """
An area chart is similar to a line chart but the region under the line is filled in. You can use the 'isStacked'
option to cause the lines to be stacked (summed). Multiple columns are supported; the first column represents the
X-axis and should be a string or numeric type; the remaining columns represent the data points at that X and
should be numeric.
"""
    },
    'bars': {
      'schemas': [
        {
          'min_cols': 2,
          'schema': [['string', 'number'], 'number', '*'],
        }
      ],
      'description': """
Bar charts are displayed horizontally; use a column chart for vertical bars. You can use the 'isStacked' option
to stack the bars. Multiple columns are supported; the first column represents the Y-axis labels or values and
should be a string or numeric type (respectively); the remaining columns represent the data points at that Xi
and should be numeric.
"""
    },
    'bubbles': {
      'schemas': [
        {
          'min_cols': 3,
          'schema': ['string', 'number', 'number', 'any', 'number'],
        }
      ],
      'description': """
A bubble chart is used to visualize a data set with two to four dimensions. The first two dimensions are
visualized as coordinates, the third as color and the fourth as size. The first column in your data should be a
string and is the bubble label. The next two columns represent the X and Y numeric values for the bubble. The
optional fourth column can be a string representing a bubble's class; all bubble's in the same class will be
 colored with the same color. Alternatively it can be a numeric value that is mapped to a color on a gradient
 (use the 'colorAxis option for this). The final fifth column must be numeric and is mapped to the bubble's
 relative size (controllable by the 'sizeAxis' option).
"""
    }
  },
  'calendar': {
    'schemas': [
      {
        'min_cols': 2,
        'schema': ['datetime', 'number'],
      }
    ],
    'description': """
A calendar chart is a visualization used to show activity over the course of a long span of time, such as months
or years. They're best used when you want to illustrate how some quantity varies depending on the day of the week,
 or how it trends over time. The first column in your data should be a date and the second should be a number.
"""
  },
  'candlestick': {
    'schemas': [
      {
        'min_cols': 5,
        'schema': ['any', 'number', 'number', 'number', 'number', ['string', 'number'], '*'],
      }
    ],
    'description': """
A candlestick chart is used to show an opening and closing value overlaid on top of a total variance. Candlestick
charts are often used to show stock value behavior. In this chart, items where the opening value is less than the
closing value (a gain) are drawn as filled boxes, and items where the opening value is more than the closing value
(a loss) are drawn as hollow boxes.

The data should be in five or more columns, where the first column defines X-axis values or group labels, and can
be a string (discrete) used as a group label, or a number or datetime (continuous). Each multiple of four or five
data columns after that defines a different series, using four numbers and an optional string for tooltip or style
info.

The four numbers for each series are, in order:

- the low/minimum value of this marker. This is the base of the candle's center line. This column's label is used
  as the series label in the legend (while the labels of the other columns are ignored).
- the opening/initial value of this marker. This is one vertical border of the candle. If less than the next
  column's value, the candle will be filled; otherwise it will be hollow.
- the closing/final value of this marker, which is the second vertical border of the candle.
- the high/maximum value of this marker, which is the top of the candle's center line.
 """
  },
  'columns': {
    'schemas': [
      {
        'min_cols': 2,
        'schema': [['string', 'number'], 'number', '*'],
      }
    ],
    'description': """
Column charts are like bar charts but displayed vertically; You can use the 'isStacked' option to stack the bars.
Multiple columns are supported; the first column represents the X-axis labels or values and should be a string ori
numeric type (respectively); the remaining columns represent the data points at that Y and should be numeric.
"""
  },
  'combo': {
    'schemas': [
      {
        'min_cols': 2,
        'schema': [['string', 'number', 'datetime'], 'number', '*'],
      }
    ],
    'description': """
A combo chart lets you render each series as a different marker type from the following list: line, area, bars,
candlesticks, and stepped area. The first column is the X axis and can be a number or datetime (continuous) or
string (discrete); the remaining columns should be numeric with each representing a separate series.

Use the 'seriesType' option to assign a default marker type for series, and the 'series' option to specify
properties of each series individually.
 """
  },
  'gauge': {
    'schemas': [
      {
        'min_cols': 2,
        'schema': ['string', 'number'],
      },
      {
        'min_cols': 1,
        'schema': ['number', '*'],
      }
    ],
    'description': """
A gauge chart shows values as a dial. You can use a string column and number column with each row being a separate
gauge labelled by the first column and with value taken from the second column, or you can use one or more numeric
columns with the gauges labelled by the column labels and the values taken from the first row.
 """
  },
  'geo': {
    'schemas': [
      {
        'schema': ['string', 'number'],
        'min_cols': 1,
      },
      {
        'schema': ['string', 'number', 'number'],
        'min_cols': 1,
      },
      {
        'schema': ['number', 'number', 'number', 'number'],
        'min_cols': 2,
      },
      {
        'schema': ['string', 'number'],
        'min_cols': 1,
      }
    ],
    'description': """
A geochart is a line drawing of a map of a country, a continent, or a region, with areas identified in one of three
ways via a 'displayMode' option:

- region mode colors whole regions, such as countries, provinces, or states. The first column should specify a region
  as a country name, uppercase ISO-3166-1 alpha-2 country code, region name or uppercase ISO-3166-2 region code, or
  three-digit US metropolitan area code, while an optional second numeric column can specify a color gradient value.
- markers mode uses circles to designate regions scaled according to a value that you specify. The first column
  should be a string specifying a specific address, or a number specifying a latitude, in which case the next column
  specifies a longitude. The next two optional numeric columns specify the marker color and size.
- text mode labels the regions with identifiers (e.g., "Russia" or "Asia") specified by the first column, with an
  optional second numeric column controlling the label size.
 """
  },
  'histogram': {
    'schemas': [
      {
        'min_cols': 1,
        'schema': ['number', '*'],
      },
      {
        'min_cols': 2,
        'schema': ['string', 'number'],
      },
    ],
    'min_cols': 1,
    'schemas': [['string', 'number'], ['number', '*']],
    'description': """
Histograms are charts that group numeric data into bins, displaying the bins as segmented columns. They're used to
depict the distribution of a dataset: how often values fall into ranges.

Google Charts automatically chooses the number of bins for you. All bins are equal width and have a heighti
proportional to the number of data points in the bin. In other respects, histograms are similar to column charts.

You can supply the data either as one or more numeric columns, with each column representing a series, or as a
(label, value) pair of columns in which case there is only one series.
 """
  },
  'line': {
    'schemas': [
      {
        'min_cols': 2,
        'schema': [['string', 'number', 'datetime'], 'number', '*'],
      }
    ],
    'description': """
Regular line charts of one or more series of Y values plotted against an X axis.

The first column represents the X axis, and can be string, number or datetime, while each additional numeric column
represents a series.
 """
  },
  'map': {
    'schemas': [
      {
        'min_cols': 2,
        'schemas': ['number', 'number', 'string'],
      },
      {
        'min_cols': 1,
        'schemas': ['string', 'string'],
      },
    ],
    'description': """
The Google Map Chart displays a map using the Google Maps API. Data values are displayed as markers on the map.
Data values can be coordinates (lat-long pairs) or addresses. The map will be scaled so that it includes all the
identified points.

If you want your maps to be line drawings rather than satellite imagery, use a geochart instead.

Two alternative data formats are supported:

- Lat-Long pairs - The first two columns should be numbers designating the latitude and longitude, respectively.
  An optional third column holds a string that describes the location specified in the first two columns.
- String address - The first column should be a string that contains an address. This address should be as complete
  as you can make it. An optional second column holds a string that describes the location in the first column.
  String addresses load more slowly, especially when you have more than 10 addresses.
 """
  },
  'org': {
    'schemas': [
      {
        'min_cols': 1,
        'schema': ['string', 'string', 'string']
      },
    ],
    'description': """
Org charts are diagrams of a hierarchy of nodes, commonly used to portray superior/subordinate relationships in
an organization. A family tree is a type of org chart.

The data should have one to three string columns, where each row represents a node in the orgchart:

- node ID. It should be unique among all nodes, and can include any characters, including spaces. This is shown
  on the node.
- optional parent node ID. Leave unspecified for a root node.
- optional tool-tip text to show, when a user hovers over this node.

Each node can have zero or one parent node, and zero or more child nodes.
 """
  },
  'paged_table': {
    'schemas': [
      {
        'min_cols': 1,
        'schema': ['any', '*'],
      },
    ],
    'description': """
A table of one or more columns, shown a page at a time.
 """
  },
  'pie': {
    'schemas': [
      {
        'min_cols': 2,
        'schema': ['string', 'number'],
      },
    ],
    'description': """
A pie chart. Each row in the table represents a slice. The first column is used for the label and the second for
the value.
 """
  },
  'sankey': {
    'schemas': [
      {
        'min_cols': 3,
        'schema': ['string', 'string', 'number'],
      },
    ],
    'description': """
A sankey diagram is a visualization used to depict a flow from one set of values to another. The things being connected
are called nodes and the connections are called links. Sankeys are best used when you want to show a many-to-many mapping
between two domains (e.g., universities and majors) or multiple paths through a set of stages (for instance, Google
Analytics uses sankeys to show how traffic flows from pages to other pages on your web site).

Each row in the table represents a connection between two labels. The third numeric column indicates the strength of
that connection, and will be reflected in the width of the path between the labels.
 """
  },
  'scatter': {
    'schemas': [
      {
        'min_cols': 2,
        'schema': [['string', 'number', 'datetime'], '*'],
      },
    ],
    'description': """
Scatter charts plot points on a 2D plane.  Each row in the table represents a set of data points with the same x-axis
value, given by the first column. Columns can be string, number or datetimes.
 """
  },
  'stepped_area': {
    'schemas': [
      {
        'min_cols': 2,
        'schema': ['string', 'number', '*'],
      },
    ],
    'description': """
A stepped area chart is similar to a stacked column chart but without column separation. Each row in the table
represents a group of bars. The first column represent the X axis and should be a string; each successive column
should be numeric and represents one of the stacked bars.
 """
  },
  'table': {
    'schemas': [
      {
        'min_cols': 1,
        'schema': ['any', '*'],
      },
    ],
    'description': """
A table of one or more columns, shown all at once. If you have a large amount of data use a paged table instead.
 """
  },
  'timeline': {
    'schemas': [
      {
        'min_cols': 3,
        'schema': ['string', 'number', 'number'],
      },
      {
        'min_cols': 3,
        'schema': ['string', 'string', 'number', 'number'],
      },
      {
        'min_cols': 3,
        'schema': ['string', 'string', 'string', 'number', 'number'],
      },
      {
        'min_cols': 3,
        'schema': ['string', 'datetime', 'datetime'],
      },
      {
        'min_cols': 3,
        'schema': ['string', 'string', 'datetime', 'datetime'],
      },
      {
        'min_cols': 3,
        'schema': ['string', 'string', 'string', 'datetime', 'datetime'],
      },
    ],
    'description': """
A timeline is a chart that depicts how a set of resources are used over time. If you're managing a software project
and want to illustrate who is doing what and when, or if you're organizing a conference and need to schedule meeting
rooms, a timeline is often a reasonable visualization choice. One popular type of timeline is the Gantt chart.

Each row in the table represents a timeline bar. The first column should contain the row labels. This can optionally
be followed by a bar label column and a tooltip column, and then by two required number or data columns representing
start and end values.
 """
  },
  'treemap': {
    'schemas': [
      {
        'min_cols': 1,
        'schema': ['string', 'string', 'number', 'number'],
      },
    ],
    'description': """
A visual representation of a data tree, where each node can have zero or more children, and one parent (except for
the root, which has no parents). Each node is displayed as a rectangle, sized and colored according to values that
you assign. Sizes and colors are valued relative to all other nodes in the graph. You can specify how many levels to
display simultaneously, and optionally to display deeper levels in a hinted fashion. If a node is a leaf node, you
can specify a size and color; if it is not a leaf, it will be displayed as a bounding box for leaf nodes. The default
behavior is to move down the tree when a user left-clicks a node, and to move back up the tree when a user
right-clicks the graph.

The total size of the graph is determined by the size of the containing element that you insert in your page. If you
have leaf nodes with names too long to show, the name will be truncated with an ellipsis (...).

Each row in the data table describes one node (a rectangle in the graph). Each node (except the root node) has one
or more parent nodes. Each node is sized and colored according to its values relative to the other nodes currently
shown.

The data table should have four columns in the following format:

- a (string) ID for the node, displayed as the node header.
- the (optional) ID of the parent node. If blank, this is the (single) root node.
- a positive number representing the size of the node, computed relative to all other nodes currently shown. For
  non-leaf nodes, this value is ignored and calculated from the size of all its children.
- an optional number used to calculate a color for this node.
 """
  }
}


def _chart_cell(args, cell):
  source = args['data']
  ipy = IPython.get_ipython()
  chart_options = _utils.parse_config(cell, ipy.user_ns)
  if chart_options is None:
    chart_options = {}
  fields = args['fields'] if args['fields'] else '*'

  _HTML_TEMPLATE = """
    <div class="bqgc" id="%s">
    </div>
    <script>
      require(['extensions/charting', 'element!%s', 'style!/static/extensions/charting.css'],
        function(charts, dom) {
          charts.render(dom, {chartStyle:'%s', dataName:'%s', fields:'%s'}, %s, %s);
        }
      );
    </script>
  """
  div_id = _html.Html.next_id()
  chart_type = args['chart']
  count = 25 if chart_type == 'paged_table' else -1
  data, _ = _utils.get_data(source, fields, 0, count)
  cols = data['cols']
  num_cols = len(cols)

  spec = _chart_data[chart_type]
  _check_schemas(chart_type, cols, spec['schemas'])
  if chart_type == 'annotation' and num_cols > 1:
    chart_options["displayAnnotations"] = True

  return IPython.core.display.HTML(
    _HTML_TEMPLATE % (div_id, div_id, chart_type, _utils.get_data_source_index(source), fields,
                      json.dumps(chart_options, cls=gcp._util.JSONEncoder),
                      json.dumps(data, cls=gcp._util.JSONEncoder)))


@IPython.core.magic.register_line_magic
def _get_chart_data(line):
  try:
    args = line.strip().split()
    source = _utils._data_sources[int(args[0])]
    fields = args[1]
    first_row = int(args[2]) if len(args) > 2 else 0
    count = int(args[3]) if len(args) > 3 else -1
    data, _ = _utils.get_data(source, fields, first_row, count)
  except Exception, e:
    gcp._util.print_exception_with_last_stack(e)
    data = {}

  return IPython.core.display.JSON(json.dumps({'data': data}, cls=gcp._util.JSONEncoder))

