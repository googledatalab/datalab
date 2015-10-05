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

"""Google Cloud Platform library - Generic SQL Helpers."""

import gcp._util as _util
from _sql_module import SqlModule
from _sql_statement import SqlStatement


def sql(sql_template, **kwargs):
  """Formats SQL templates by replacing placeholders with actual values.

  Placeholders in SQL are represented as $<name>. If '$' must appear within the
  SQL statement literally, then it can be escaped as '$$'.

  Args:
    sql_template: the template of the SQL statement with named placeholders.
    **kwargs: the dictionary of name/value pairs to use for placeholder values.
  Returns:
    The formatted SQL statement with placeholders replaced with their values.
  Raises:
    Exception if a placeholder was found in the SQL statement, but did not have
    a corresponding argument value.
  """
  return _util.Sql.format(sql_template, kwargs)


def _next_token(sql):
  """ This is a basic tokenizer for our limited purposes.
  It splits a SQL statement up into a series of segments, where a segment is one of:
  - identifiers
  - left or right parentheses
  - multi-line comments
  - single line comments
  - white-space sequences
  - string literals
  - consecutive strings of characters that are not one of the items above

  The aim is for us to be able to find function calls (identifiers followed by '('), and the
  associated closing ')') so we can augment these if needed.

  Args:
    sql: a SQL statement as a (possibly multi-line) string.

  Returns:
    For each call, the next token in the initial input.
  """
  i = 0

  # We use some lambda's to make the logic more clear. The start_* functions return
  # true if i is the index of the start of that construct, while the end_* functions
  # return true if i point to the first character beyond that construct or the end of the
  # content.
  #
  # We don't currently need numbers so the tokenizer here just does sequences of
  # digits as a convenience to shrink the total number of tokens. If we needed numbers
  # later we would need a special handler for these much like strings.

  start_multi_line_comment = lambda s, i: s[i] == '/' and i < len(s) - 1 and s[i + 1] == '*'
  end_multi_line_comment = lambda s, i: s[i - 2] == '*' and s[i - 1] == '/'
  start_single_line_comment = lambda s, i: s[i] == '-' and i < len(s) - 1 and s[i + 1] == '-'
  end_single_line_comment = lambda s, i: s[i - 1] == '\n'
  start_whitespace = lambda s, i: s[i].isspace()
  end_whitespace = lambda s, i: not s[i].isspace()
  start_number = lambda s, i: s[i].isdigit()
  end_number = lambda s, i: not s[i].isdigit()
  start_identifier = lambda s, i: s[i].isalpha() or s[i] == '_' or s[i] == '$'
  end_identifier = lambda s, i: not(s[i].isalnum() or s[i] == '_')
  start_string = lambda s, i: s[i] =='"' or s[i] == "'"
  always_true = lambda s, i: True

  while i < len(sql):
    start = i
    if start_multi_line_comment(sql, i):
      i += 1
      end_checker = end_multi_line_comment
    elif start_single_line_comment(sql, i):
      i += 1
      end_checker = end_single_line_comment
    elif start_whitespace(sql, i):
      end_checker = end_whitespace
    elif start_identifier(sql, i):
      end_checker = end_identifier
    elif start_number(sql, i):
      end_checker = end_number
    elif start_string(sql, i):
      # Special handling here as we need to check for escaped closing quotes.
      quote = sql[i]
      end_checker = always_true
      i += 1
      while i < len(sql) and sql[i] != quote:
        i += 2 if sql[i] == '\\' else 1
    else:
      # We return single characters for everything else
      end_checker = always_true

    i += 1
    while i < len(sql) and not end_checker(sql, i):
      i += 1

    (yield sql[start:i])


def tokenize(sql):
  """ This is a basic tokenizer for our limited purposes.
  It splits a SQL statement up into a series of segments, where a segment is one of:
  - identifiers
  - left or right parentheses
  - multi-line comments
  - single line comments
  - white-space sequences
  - string literals
  - consecutive strings of characters that are not one of the items above

  The aim is for us to be able to find function calls (identifiers followed by '('), and the
  associated closing ')') so we can augment these if needed.

  Args:
    sql: a SQL statement as a (possibly multi-line) string.

  Returns:
    A list of strings corresponding to the groups above.
  """
  return list(_next_token(sql))

