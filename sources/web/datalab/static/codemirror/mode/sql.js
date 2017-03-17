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

  CodeMirror.defineMode('sql', function(config) {
    var indentUnit = config.indentUnit;
    var curPunc;

    function wordRegexp(words) {
      return new RegExp('^(?:' + words.join('|') + ')$', 'i');
    }

    var keywords = wordRegexp([
      'ALL',
      'AND',
      'ARRAY',
      'AS',
      'ASC',
      'BETWEEN',
      'BY',
      'CASE',
      'CONTAINS',
      'COUNT',
      'CROSS',
      'DELETE',
      'DESC',
      'DISTINCT',
      'EACH',
      'ELSE',
      'END',
      'FALSE',
      'FROM',
      'FULL',
      'GROUP',
      'HAVING',
      'IGNORE',
      'IN',
      'INNER',
      'INSERT',
      'IS',
      'JOIN',
      'LEFT',
      'LIKE',
      'LIMIT',
      'NOT',
      'NULL',
      'OMIT',
      'ON',
      'OR',
      'ORDER',
      'OUTER',
      'OVER',
      'PARTITION',
      'RECORD',
      'RIGHT',
      'ROLLUP',
      'SELECT',
      'SET',
      'STRUCT',
      'THEN',
      'TRUE',
      'UNION',
      'UNNEST',
      'UPDATE',
      'VALUES',
      'WHEN',
      'WHERE',
      'WITH',
      'WITHIN',
      'XOR',

      // DataLab extensions
      'DEFINE',
      'QUERY'
    ]);

    /*
     * Based on the documentation at:
     * https://developers.google.com/bigquery/query-reference
     */
    var functions = wordRegexp([
      'ABS',
      'ACOS',
      'ACOSH',
      'ASIN',
      'ASINH',
      'ATAN',
      'ATAN2',
      'ATANH',
      'AVG',
      'BIT_AND',
      'BIT_COUNT',
      'BIT_OR',
      'BIT_XOR',
      'BOOLEAN',
      'CAST',  // Not really a function, but close enough for syntax highlighting.
      'CEIL',
      'COALESCE',
      'CONCAT',
      'CORR',
      'COS',
      'COSH',
      'COUNT',
      'COVAR_POP',
      'COVAR_SAMP',
      'CUME_DIST',
      'CURRENT_DATE',
      'CURRENT_TIME',
      'CURRENT_TIMESTAMP',
      'DATE',
      'DATEDIFF',
      'DATE_ADD',
      'DAY',
      'DAYOFWEEK',
      'DAYOFYEAR',
      'DEGREES',
      'DENSE_RANK',
      'DOMAIN',
      'EVERY',
      'EXACT_COUNT_DISTINCT',
      'EXP',
      'FIRST',
      'FIRST_VALUE',
      'FLATTEN',
      'FLOAT',
      'FLOOR',
      'FORMAT_IP',
      'FORMAT_PACKED_IP',
      'FORMAT_UTC_USEC',
      'GREATEST',
      'GROUPING',
      'GROUP_CONCAT',
      'GROUP_CONCAT_UNQUOTED',
      'HASH',
      'HEX_STRING',
      'HOST',
      'HOUR',
      'IF',
      'IFNULL',
      'INSTR',
      'INTEGER',
      'IS_EXPLICITLY_DEFINED',
      'IS_INF',
      'IS_NAN',
      'JSON_EXTRACT',
      'JSON_EXTRACT_SCALAR',
      'LAG',
      'LAST',
      'LAST_VALUE',
      'LEAD',
      'LEAST',
      'LEFT',
      'LENGTH',
      'LN',
      'LOG',
      'LOG10',
      'LOG2',
      'LOWER',
      'LPAD',
      'LTRIM',
      'NTILE',
      'MAX',
      'MIN',
      'MINUTE',
      'MONTH',
      'MSEC_TO_TIMESTAMP',
      'NEST',
      'NOW',
      'NTH',
      'NTH_VALUE',
      'PARSE_IP',
      'PARSE_PACKED_IP',
      'PARSE_UTC_USEC',
      'PERCENT_RANK',
      'PERCENTILE_CONT',
      'PERCENTILE_DISC',
      'PERCENTILE_RANK',
      'PI',
      'POSITION',
      'POW',
      'QUANTILES',
      'QUARTER',
      'RADIANS',
      'RAND',
      'RANK',
      'RATIO_TO_REPORT',
      'REGEXP_EXTRACT',
      'REGEXP_MATCH',
      'REGEXP_REPLACE',
      'REPLACE',
      'RIGHT',
      'ROUND',
      'ROW_NUMBER',
      'RPAD',
      'RTRIM',
      'SECOND',
      'SEC_TO_TIMESTAMP',
      'SIN',
      'SINH',
      'SOME',
      'SPLIT',
      'SQRT',
      'STDDEV',
      'STDDEV_POP',
      'STDDEV_SAMP',
      'STRFTIME_UTC_USEC',
      'STRING',
      'SUBSTR',
      'SUM',
      'TABLE_DATE_RANGE',
      'TABLE_DATE_RANGE_STRICT',
      'TABLE_QUERY',
      'TAN',
      'TANH',
      'TIME',
      'TIMESTAMP',
      'TIMESTAMP_TO_MSEC',
      'TIMESTAMP_TO_SEC',
      'TIMESTAMP_TO_USEC',
      'TLD',
      'TOP',
      'UNIQUE',
      'UPPER',
      'USEC_TO_TIMESTAMP',
      'UTC_USEC_TO_DAY',
      'UTC_USEC_TO_HOUR',
      'UTC_USEC_TO_MONTH',
      'UTC_USEC_TO_QUARTER',
      'UTC_USEC_TO_WEEK',
      'UTC_USEC_TO_YEAR',
      'VARIANCE',
      'VAR_POP',
      'VAR_SAMP',
      'WEEK',
      'YEAR',

      // DataLab extensions
      'source',
      'datestring'
    ]);

    var types = wordRegexp([]);

    var operatorChars = /[<>*+=&|\\-]/;
    var punctuationChars = /[{}\(\),;\[\]]/;

    function tokenBase(stream, state) {
      var ch = stream.next();
      curPunc = null;
      if (stream.column() == 0 && ch == '#') {
        stream.skipToEnd();
        return 'comment';
      } else if (ch === '$' || ch === '?') {
        stream.match(/^[\w\d]*/);
        return 'variable-2';
      } else if (ch === '<' && !stream.match(/^[\s\u00a0=]/, false)) {
        stream.match(/^[^\s\u00a0>]*>?/);
        return 'atom';
      } else if (ch === '"' || ch === '\'') {
        state.tokenize = tokenLiteral(ch);
        return state.tokenize(stream, state);
      } else if (ch === '`') {
        state.tokenize = tokenOpLiteral(ch);
        return state.tokenize(stream, state);
      } else if (punctuationChars.test(ch)) {
        curPunc = ch;
        return null;
      } else if (ch === '-') {
        var ch2 = stream.next();
        if (ch2 === '-') {
          stream.skipToEnd();
          return 'comment';
        }
      } else if (operatorChars.test(ch)) {
        stream.eatWhile(operatorChars);
        return 'operator';
      } else if (ch === ':') {
        stream.eatWhile(/[\w\d._\-]/);
        return 'atom';
      } else if (ch.charCodeAt(0) > 47 && ch.charCodeAt(0) < 58) {
        stream.match(/^[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/);
        return "number"
      } else {
        stream.eatWhile(/[_\w\d.\-]/);
        if (stream.eat(':')) {
          stream.eatWhile(/[\w\d._\-]/);
          return 'atom';
        }

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

    function tokenOpLiteral(quote) {
      return function(stream, state) {
        var escaped = false, ch;
        while ((ch = stream.next()) != null) {
          if (ch === quote && !escaped) {
            state.tokenize = tokenBase;
            break;
          }
          escaped = !escaped && ch === '\\'
        }
        return 'variable-2';
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

  CodeMirror.defineMIME('text/sql', 'sql');
});

