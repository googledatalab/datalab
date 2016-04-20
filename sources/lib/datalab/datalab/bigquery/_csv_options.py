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

"""Implements CSV options for External Tables and Table loads from GCS."""


class CSVOptions(object):

  def __init__(self, delimiter=',', skip_leading_rows=0, encoding='utf-8', quote='"',
               allow_quoted_newlines=False, allow_jagged_rows=False):

    """ Initialize an instance of CSV options.

    Args:
      delimiter: The separator for fields in a CSV file. BigQuery converts the string to
          ISO-8859-1 encoding, and then uses the first byte of the encoded string to split the data
          as raw binary (default ',').
      skip_leading_rows: A number of rows at the top of a CSV file to skip (default 0).
      encoding: The character encoding of the data, either 'utf-8' (the default) or 'iso-8859-1'.
      quote: The value used to quote data sections in a CSV file; default '"'. If your data does
          not contain quoted sections, set the property value to an empty string. If your data
          contains quoted newline characters, you must also enable allow_quoted_newlines.
      allow_quoted_newlines: If True, allow quoted data sections in CSV files that contain newline
          characters (default False).
      allow_jagged_rows: If True, accept rows in CSV files that are missing trailing optional
          columns; the missing values are treated as nulls (default False).
    """
    encoding_upper = encoding.upper()
    if encoding_upper != 'UTF-8' and encoding_upper != 'ISO-8859-1':
      raise Exception("Invalid source encoding %s" % encoding)

    self._delimiter = delimiter
    self._skip_leading_rows = skip_leading_rows
    self._encoding = encoding
    self._quote = quote
    self._allow_quoted_newlines = allow_quoted_newlines
    self._allow_jagged_rows = allow_jagged_rows

  @property
  def delimiter(self):
    return self._delimiter

  @property
  def skip_leading_rows(self):
    return self._skip_leading_rows

  @property
  def encoding(self):
    return self._encoding

  @property
  def quote(self):
      return self._quote

  @property
  def allow_quoted_newlines(self):
    return self._allow_quoted_newlines

  @property
  def allow_jagged_rows(self):
    return self._allow_jagged_rows

  def _to_query_json(self):
    """ Return the options as a dictionary to be used as JSON in a query job. """
    return {
      'quote': self._quote,
      'fieldDelimiter': self._delimiter,
      'encoding': self._encoding.upper(),
      'skipLeadingRows': self._skip_leading_rows,
      'allowQuotedNewlines': self._allow_quoted_newlines,
      'allowJaggedRows': self._allow_jagged_rows
    }
