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

define(
  ["require", 'codemirror/lib/codemirror'],
  function (require, CodeMirror) {

  /*
   * Based on the documentation at:
   * https://cloud.google.com/bigquery/docs/reference/standard-sql/lexical
   */
  var bq_keywords = [
    'ALL', 'AND', 'ANY', 'AS', 'ASC', 'ASSERT_ROWS_MODIFIED', 'AT', 'BETWEEN', 'BY', 'CASE', 'CAST',
    'COLLATE', 'CONTAINS', 'CREATE', 'CROSS', 'CUBE', 'CURRENT', 'DEFAULT', 'DEFINE', 'DELETE',
    'DESC', 'DISTINCT', 'ELSE', 'END', 'ENUM', 'ESCAPE', 'EXCEPT', 'EXCLUDE', 'EXISTS',
    'EXTRACT', 'FALSE', 'FETCH', 'FOLLOWING', 'FOR', 'FROM', 'FULL', 'GROUP', 'GROUPING',
    'GROUPS', 'HASH', 'HAVING', 'IF', 'IGNORE', 'IN', 'INNER', 'INSERT', 'INTERSECT', 'INTERVAL',
    'INTO', 'IS', 'JOIN', 'LATERAL', 'LEFT', 'LIKE', 'LIMIT', 'LOOKUP', 'MERGE', 'NATURAL', 'NEW',
    'NO', 'NOT', 'NULL', 'NULLS', 'OF', 'ON', 'OR', 'ORDER', 'OUTER', 'OVER', 'PARTITION',
    'PRECEDING', 'PROTO', 'RANGE', 'RECURSIVE', 'RESPECT', 'RIGHT', 'ROLLUP', 'ROWS', 'SELECT',
    'SET', 'SOME', 'TABLESAMPLE', 'THEN', 'TO', 'TREAT', 'TRUE', 'UNBOUNDED', 'UNION', 'UNNEST',
    'UPDATE', 'USING', 'WHEN', 'WHERE', 'WINDOW', 'WITH', 'WITHIN'
  ];

  /*
   * Based on the documentation at:
   * https://developers.google.com/bigquery/query-reference
   */
  var bq_functions = [
    'ABS', 'ACOS', 'ACOSH', 'ANY_VALUE', 'APPROX_COUNT_DISTINCT', 'APPROX_QUANTILES',
    'APPROX_TOP_COUNT', 'APPROX_TOP_SUM', 'ARRAY_AGG', 'ARRAY_CONCAT', 'ARRAY_CONCAT_AGG',
    'ARRAY_LENGTH', 'ARRAY_REVERSE', 'ARRAY_TO_STRING', 'ASIN', 'ASINH', 'ATAN', 'ATAN2',
    'ATANH', 'AVG', 'BIT_AND', 'BIT_COUNT', 'BIT_OR', 'BIT_XOR', 'BYTE_LENGTH', 'CEIL',
    'CEILING', 'CHARACTER_LENGTH', 'CHAR_LENGTH', 'CODE_POINTS_TO_BYTES',
    'CODE_POINTS_TO_STRING', 'CONCAT', 'CORR', 'COS', 'COSH', 'COUNT', 'COUNTIF', 'COVAR_POP',
    'COVAR_SAMP', 'CUME_DIST', 'CURRENT_DATE', 'CURRENT_DATETIME', 'CURRENT_TIME',
    'CURRENT_TIMESTAMP', 'DATE', 'DATETIME', 'DATETIME_ADD', 'DATETIME_DIFF', 'DATETIME_SUB',
    'DATETIME_TRUNC', 'DATE_ADD', 'DATE_DIFF', 'DATE_FROM_UNIX_DATE', 'DATE_SUB', 'DATE_TRUNC',
    'DENSE_RANK', 'DIV', 'ENDS_WITH', 'EXP', 'EXTRACT', 'FARM_FINGERPRINT', 'FIRST_VALUE',
    'FLOOR', 'FORMAT', 'FORMAT_DATE', 'FORMAT_DATETIME', 'FORMAT_TIME', 'FORMAT_TIMESTAMP',
    'FROM_BASE64', 'GENERATE_ARRAY', 'GENERATE_DATE_ARRAY', 'GREATEST', 'IEEE_DIVIDE', 'IS_INF',
    'IS_NAN', 'JSON_EXTRACT', 'JSON_EXTRACT_SCALAR', 'LAG', 'LAST_VALUE', 'LEAD', 'LEAST',
    'LENGTH', 'LN', 'LOG', 'LOG10', 'LOGICAL_AND', 'LOGICAL_OR', 'LOWER', 'LPAD', 'LTRIM', 'MAX',
    'MD5', 'MIN', 'MOD', 'NET.HOST', 'NET.IPV4_FROM_INT64', 'NET.IPV4_TO_INT64',
    'NET.IP_FROM_STRING', 'NET.IP_NET_MASK', 'NET.IP_TO_STRING', 'NET.IP_TRUNC',
    'NET.PUBLIC_SUFFIX', 'NET.REG_DOMAIN', 'NET.SAFE_IP_FROM_STRING', 'NTH_VALUE', 'NTILE',
    'OFFSET', 'ORDINAL', 'PARSE_DATE', 'PARSE_DATETIME', 'PARSE_TIME', 'PARSE_TIMESTAMP',
    'PERCENT_RANK', 'POW', 'POWER', 'RAND', 'RANK', 'REGEXP_CONTAINS', 'REGEXP_EXTRACT',
    'REGEXP_EXTRACT_ALL', 'REGEXP_REPLACE', 'REPEAT', 'REPLACE', 'REVERSE', 'ROUND',
    'ROW_NUMBER', 'RPAD', 'RTRIM', 'SAFE_CONVERT_BYTES_TO_STRING', 'SAFE_DIVIDE', 'SAFE_OFFSET',
    'SAFE_ORDINAL', 'SESSION_USER', 'SHA1', 'SHA256', 'SHA512', 'SIGN', 'SIN', 'SINH', 'SPLIT',
    'SQRT', 'STARTS_WITH', 'STDDEV', 'STDDEV_POP', 'STDDEV_SAMP', 'STRING_AGG',
    'STRPOS', 'SUBSTR', 'SUM', 'TAN', 'TANH', 'TIMESTAMP', 'TIMESTAMP_ADD', 'TIMESTAMP_DIFF',
    'TIMESTAMP_MICROS', 'TIMESTAMP_MILLIS', 'TIMESTAMP_SECONDS', 'TIMESTAMP_SUB',
    'TIMESTAMP_TRUNC', 'TIME_ADD', 'TIME_DIFF', 'TIME_SUB', 'TIME_TRUNC', 'TO_BASE64',
    'TO_CODE_POINTS', 'TRIM', 'TRUNC', 'UNIX_DATE', 'UNIX_MICROS', 'UNIX_MILLIS', 'UNIX_SECONDS',
    'UPPER', 'VARIANCE', 'VAR_POP', 'VAR_SAMP'
  ];

  var bq_types = [
    'INT64', 'FLOAT64', 'BOOL', 'STRING', 'BYTES', 'DATE', 'TIME', 'TIMESTAMP', 'ARRAY', 'STRUCT'
  ];

  var bq_operatorChars = /[.~^!<>*+=&|\\-]/;

  var bq_punctuationChars = /[{}\(\),;\[\]]/;

  CodeMirror.defineMode('bigquery', function(config) {
    var indentUnit = config.indentUnit;
    var curPunc;

    function wordRegexp(words) {
      return new RegExp('^(?:' + words.join('|') + ')$', 'i');
    }

    keywords = wordRegexp(bq_keywords);
    functions = wordRegexp(bq_functions);
    types = wordRegexp(bq_types);

    function tokenBase(stream, state) {
      var ch = stream.next();
      curPunc = null;
      if (ch == '#') {
        stream.skipToEnd();
        return 'comment';
      } else if (ch === '-') {
        var ch2 = stream.next();
        if (ch2 === '-') {
          stream.skipToEnd();
          return 'comment';
        }
      } else if (ch === '$' || ch === '?' || ch === '@') {
        stream.match(/^[\w\d]*/);
        return 'atom';
      } else if (ch === '"' || ch === '\'' || ch === '`') {
        state.tokenize = tokenLiteral(ch);
        return state.tokenize(stream, state);
      } else if (bq_punctuationChars.test(ch)) {
        curPunc = ch;
        return null;
      } else if (bq_operatorChars.test(ch)) {
        stream.eatWhile(bq_operatorChars);
        return 'operator';
      } else if (ch.charCodeAt(0) > 47 && ch.charCodeAt(0) < 58) {
        stream.match(/^[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/);
        return "number"
      } else {
        stream.eatWhile(/[_\w\d.\-]/);

        var word = stream.current();
        if (functions.test(word))
          return 'function';
        else if (keywords.test(word))
          return 'keyword';
        else if (types.test(word))
          return 'type';
        else
          return 'variable';
      }
    }

    function tokenLiteral(quote) {
      return function(stream, state) {
        var escaped = false, ch;
        while ((ch = stream.next()) != null) {
          if (ch === quote && !escaped) {
            state.tokenize = tokenBase;
            break;
          }
          escaped = !escaped && ch === '\\';
        }
        return 'string';
      };
    }

    function pushContext(state, type, col) {
      state.context = {
        prev: state.context,
        indent: state.indent,
        col: col,
        type: type
      };
    }

    function popContext(state) {
      state.indent = state.context.indent;
      state.context = state.context.prev;
    }

    return {
      startState: function(base) {
        return {
          tokenize: tokenBase,
          context: null,
          indent: 0,
          col: 0
        };
      },

      token: function(stream, state) {
        if (stream.sol()) {
          if (state.context && state.context.align === null) {
            state.context.align = false;
          }
          state.indent = stream.indentation();
        }
        if (stream.eatSpace()) {
          return null;
        }
        var style = state.tokenize(stream, state);

        if (style !== 'comment' && state.context && state.context.align === null &&
          state.context.type !== 'pattern') {
          state.context.align = true;
        }

        if (curPunc === '(') {
          pushContext(state, ')', stream.column());
        } else if (curPunc === '[') {
          pushContext(state, ']', stream.column());
        } else if (curPunc === '{') {
          pushContext(state, '}', stream.column());
        } else if (/[\]}\)]/.test(curPunc)) {
          while (state.context && state.context.type === 'pattern') {
            popContext(state);
          }
          if (state.context && curPunc === state.context.type) {
            popContext(state);
          }
        } else if (curPunc === '.' && state.context &&
          state.context.type === 'pattern') {
          popContext(state);
        } else if (/atom|string|variable/.test(style) && state.context) {
          if (/[}\]]/.test(state.context.type)) {
            pushContext(state, 'pattern', stream.column());
          } else if (state.context.type === 'pattern' && !state.context.align) {
            state.context.align = true;
            state.context.col = stream.column();
          }
        }

        return style;
      },

      indent: function(state, textAfter) {
        var firstChar = textAfter && textAfter.charAt(0);
        var context = state.context;
        if (/[\]}]/.test(firstChar)) {
          while (context && context.type === 'pattern') {
            context = context.prev;
          }
        }
        var closing = context && firstChar === context.type;
        if (!context) {
          return 0;
        } else if (context.type === 'pattern') {
          return context.col;
        } else if (context.align) {
          return context.col + (closing ? 0 : 1);
        } else {
          return context.indent + (closing ? 0 : indentUnit);
        }
      }
    };
  });

  CodeMirror.defineMIME('text/bigquery', 'bigquery');

  return {
    keywords: bq_keywords,
    functions: bq_functions,
    types: bq_types,
    operatorChars: bq_operatorChars
  };
});

