# Copyright 2014 Google Inc. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Google Cloud Platform library - IPython HTML display Functionality."""


class HtmlBuilder(object):
  """A set of helpers to build HTML representations of objects.
  """

  def __init__(self):
    """Initializes an instance of an HtmlBuilder.
    """
    self._segments = []

  def render_objects(self, items, attributes=None, dictionary=False, title=None):
    """Renders an HTML table with the specified list of objects.

    Args:
      items: the iterable collection objects to render.
      attributes: the optional list of properties or keys to render.
      dictionary: whether the list contains generic object or specifically dict instances.
      title: if set, show a title in the first row
    """
    if not items:
      return

    if dictionary:
      getter = lambda obj, attr: obj.get(attr, None)
    else:
      getter = lambda obj, attr: obj.__getattribute__(attr)

    num_segments = len(self._segments)
    self._segments.append('<table>')

    first = True

    for o in items:
      if first:
        first = False
        if dictionary and not attributes:
          attributes = o.keys()

        if title:
          self._segments.append(
              '<tr><th colspan=%d style="background-color:LightGray;text-align:center">%s</th></tr>'
              % (len(attributes) if attributes else 1, title))
        if attributes is not None:
          self._segments.append('<tr>')
          for attr in attributes:
            self._segments.append('<th><em>%s</th>' % attr)
          self._segments.append('</tr>')

      self._segments.append('<tr>')
      if attributes is None:
        self._segments.append('<td>%s</td>' % self._format(o))
      else:
        for attr in attributes:
          self._segments.append('<td>%s</td>' % self._format(getter(o, attr), nbsp=True))
      self._segments.append('</tr>')

    self._segments.append('</table>')
    if first:
      # The table was empty; drop it from the segments.
      self._segments = self._segments[:num_segments]

  def render_text(self, text, preformatted=False):
    """Renders an HTML formatted text block with the specified text.

    Args:
      text: the text to render
      preformatted: whether the text should be rendered as preformatted
    """
    tag = 'pre' if preformatted else 'div'
    self._segments.append('<%s>%s</%s>' % (tag, self._format(text), tag))

  def to_html(self):
    """Returns the HTML that has been rendered.

    Returns:
      The HTML string that has been built.
    """
    return ''.join(self._segments)

  def _format(self, value, nbsp=False):
    if value is None:
      return '&nbsp;' if nbsp else ''
    elif isinstance(value, basestring):
      return value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    else:
      return str(value)
