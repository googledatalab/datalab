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

"""Google Cloud Platform library - IPython HTML display Functionality."""

import time


class Html(object):
  """A helper to enable generating an HTML representation as display data in a notebook.

  This object supports the combination of HTML markup and/or associated JavaScript.
  """

  _div_id_counter = 0

  @staticmethod
  def next_id():
    """ Return an ID containing a reproducible part (counter) and unique part (timestamp). """
    Html._div_id_counter += 1
    return '%d_%d' % (Html._div_id_counter, int(round(time.time() * 100)))

  def __init__(self, markup=None):
    """Initializes an instance of Html.
    """
    self._id = Html.next_id()
    Html._div_id_counter += 1
    self._class_name = ''
    self._markup = markup
    self._dependencies = [('element!hh_%d' % self._id, 'dom')]
    self._script = ''
    self._class = None

  def add_class(self, class_name):
    """Adds a CSS class to be generated on the output HTML.

    Args:
      class_name: the name of the CSS class.
    """
    self._class = class_name

  def add_dependency(self, path, name):
    """Adds a script dependency to be loaded before any script is executed.

    Args:
      path: the path passed to require() for the script.
      name: the argument used for the script module in the require() callback.
    """
    self._dependencies.append((path, name))

  def add_script(self, script):
    """Adds JavaScript that should be included along-side the HTML.
    """
    self._script = script

  def _repr_html_(self):
    """Generates the HTML representation.
    """
    parts = []
    if self._class:
      parts.append('<div id="hh_%s" class="%s">%s</div>' % (self._id, self._class, self._markup))
    else:
      parts.append('<div id="hh_%s">%s</div>' % (self._id, self._markup))

    if len(self._script) != 0:
      parts.append('<script>')
      parts.append('require([')
      parts.append(','.join(map(lambda d: '"%s"' % d[0], self._dependencies)))
      parts.append('], function(')
      parts.append(','.join(map(lambda d: d[1], self._dependencies)))
      parts.append(') {')
      parts.append(self._script)
      parts.append('});')
      parts.append('</script>')

    return ''.join(parts)


class HtmlBuilder(object):
  """A set of helpers to build HTML representations of objects.
  """

  def __init__(self):
    """Initializes an instance of an HtmlBuilder.
    """
    self._segments = []

  def _render_objects(self, items, attributes=None, datatype='object'):
    """Renders an HTML table with the specified list of objects.

    Args:
      items: the iterable collection of objects to render.
      attributes: the optional list of properties or keys to render.
      datatype: the type of data; one of 'object' for Python objects, 'dict' for a list
          of dictionaries, or 'chartdata' for Google chart data.
      dictionary: whether the list contains generic object or specifically dict instances.
    """
    if not items:
      return

    if datatype == 'dict':
      getter = lambda obj, attribute: obj.get(attribute, None)
    elif datatype == 'chartdata':
      if not attributes:
        attributes = [items['cols'][i]['label'] for i in range(0, len(items['cols']))]
      items = items['rows']
      indices = {attributes[i]: i for i in range(0, len(attributes))}
      getter = lambda obj, attribute: obj['c'][indices[attribute]]['v']
    else:
      getter = lambda obj, attribute: obj.__getattribute__(attribute)

    num_segments = len(self._segments)
    self._segments.append('<table>')

    first = True
    for o in items:
      if first:
        first = False
        if datatype == 'dict' and not attributes:
          attributes = o.keys()

        if attributes is not None:
          self._segments.append('<tr>')
          for attr in attributes:
            self._segments.append('<th>%s</th>' % attr)
          self._segments.append('</tr>')

      self._segments.append('<tr>')
      if attributes is None:
        self._segments.append('<td>%s</td>' % HtmlBuilder._format(o))
      else:
        for attr in attributes:
          self._segments.append('<td>%s</td>' % HtmlBuilder._format(getter(o, attr), nbsp=True))
      self._segments.append('</tr>')

    self._segments.append('</table>')
    if first:
      # The table was empty; drop it from the segments.
      self._segments = self._segments[:num_segments]

  def _render_text(self, text, preformatted=False):
    """Renders an HTML formatted text block with the specified text.

    Args:
      text: the text to render
      preformatted: whether the text should be rendered as preformatted
    """
    tag = 'pre' if preformatted else 'div'
    self._segments.append('<%s>%s</%s>' % (tag, HtmlBuilder._format(text), tag))

  def _render_list(self, items, empty='<pre>&lt;empty&gt;</pre>'):
    """Renders an HTML list with the specified list of strings.

    Args:
      items: the iterable collection of objects to render.
      empty: what to render if the list is None or empty.
    """
    if not items or len(items) == 0:
      self._segments.append(empty)
      return
    self._segments.append('<ul>')
    for o in items:
      self._segments.append('<li>')
      self._segments.append(str(o))
      self._segments.append('</li>')
    self._segments.append('</ul>')

  def _to_html(self):
    """Returns the HTML that has been rendered.

    Returns:
      The HTML string that has been built.
    """
    return ''.join(self._segments)

  @staticmethod
  def _format(value, nbsp=False):
    if value is None:
      return '&nbsp;' if nbsp else ''
    elif isinstance(value, basestring):
      return value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    else:
      return str(value)

  @staticmethod
  def render_text(text, preformatted=False):
    """Renders an HTML formatted text block with the specified text.

    Args:
      text: the text to render
      preformatted: whether the text should be rendered as preformatted
    Returns:
      The formatted HTML.
    """
    builder = HtmlBuilder()
    builder._render_text(text, preformatted=preformatted)
    return builder._to_html()

  @staticmethod
  def render_table(data, headers=None):
    """ Return a dictionary list formatted as a HTML table.

    Args:
      data: a list of dictionaries, one per row.
      headers: the keys in the dictionary to use as table columns, in order.
    """
    builder = HtmlBuilder()
    builder._render_objects(data, headers, datatype='dict')
    return builder._to_html()

  @staticmethod
  def render_chart_data(data):
    """ Return a dictionary list formatted as a HTML table.

    Args:
      data: data in the form consumed by Google Charts.
    """
    builder = HtmlBuilder()
    builder._render_objects(data, datatype='chartdata')
    return builder._to_html()

  @staticmethod
  def render_list(data):
    """ Return a list formatted as a HTML list.

    Args:
      data: a list of strings.
    """
    builder = HtmlBuilder()
    builder._render_list(data)
    return builder._to_html()
