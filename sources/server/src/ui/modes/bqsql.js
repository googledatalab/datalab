/*
 * Copyright 2013 Google Inc. All rights reserved.
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

  define(["require", 'codeMirror'], function (require, CodeMirror) {
  CodeMirror.defineMode('bqsql', function(config) {
    var indentUnit = config.indentUnit;
    var curPunc;

    function wordRegexp(words) {
      return new RegExp('^(?:' + words.join('|') + ')$', 'i');
    }

    var keywords = wordRegexp([
      'SELECT', 'WITHIN', 'FROM', 'FLATTEN', 'JOIN', 'WHERE', 'GROUP BY',
      'HAVING', 'ORDER BY', 'LIMIT', 'IF', 'IN', 'IS', 'NULL', 'CONTAINS',
      'CASE', 'WHEN', 'THEN', 'END', 'GROUP', 'ORDER', 'BY', 'AS', 'AND', 'ELSE'
    ]);

    /*
     * Based on the documentation at:
     * https://developers.google.com/bigquery/query-reference
     */
    var functions = wordRegexp([
      'AVG', 'CORR', 'COUNT', 'DISTINCT', 'GROUP_CONCAT', 'QUANTILES',
      'STDDEV', 'VARIANCE', 'LAST', 'MAX', 'MIN', 'NTH', 'SUM', 'TOP',
      'BOOLEAN', 'FLOAT', 'HEX_STRING', 'INTEGER', 'STRING',
      'BETWEEN', 'IFNULL', 'IS_INF', 'IS_NAN', 'IS_EXPLICITLY_DEFINED',
      'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP', 'DATE',
      'DATE_ADD', 'DATEDIFF', 'DAY', 'DAYOFWEEK', 'DAYOFYEAR',
      'FORMAT_UTC_USEC', 'HOUR', 'MINUTE', 'MONTH', 'MSEC_TO_TIMESTAMP',
      'NOW', 'PARSE_UTC_USEC', 'QUARTER', 'SEC_TO_TIMESTAMP', 'SECOND',
      'STRFTIME_UTC_USEC', 'TIME', 'TIMESTAMP', 'TIMESTAMP_TO_MSEC',
      'TIMESTAMP_TO_SEC', 'TIMESTAMP_TO_USEC', 'USEC_TO_TIMESTAMP',
      'UTC_USEC_TO_DAY', 'UTC_USEC_TO_HOUR', 'UTC_USEC_TO_MONTH',
      'UTC_USEC_TO_WEEK', 'UTC_USEC_TO_YEAR', 'YEAR',
      'FORMAT_IP', 'PARSE_IP', 'FORMAT_PACKED_IP', 'PARSE_PACKED_IP',
      'ABS', 'ACOS', 'ACOSH', 'ASIN', 'ASINH', 'ATAN', 'ATANH', 'ATAN2',
      'CEIL', 'COS', 'COSH', 'DEGREES', 'FLOOR', 'LN', 'LOG', 'LOG2', 'LOG10',
      'PI', 'POW', 'RADIANS', 'ROUND', 'SIN', 'SINH', 'SQRT', 'TAN', 'TANH',
      'REGEXP_MATCH', 'REGEXP_EXTRACT', 'REGEXP_REPLACE', 'CONCAT', 'LEFT',
      'LENGTH', 'LOWER', 'LPAD', 'RIGHT', 'RPAD', 'SUBSTR', 'UPPER',
      'HOST', 'DOMAIN', 'TLD', 'CUME_DIST', 'DENSE_RANK', 'LAG',
      'LEAD', 'NTILE', 'PERCENT_RANK', 'PERCENTILE_CONT', 'PERCENTILE_DISC',
      'RANK', 'RATIO_TO_REPORT', 'ROW_NUMBER',
      'HASH', 'IF', 'POSITION']);

    var types = wordRegexp([]);

    var operatorChars = /[*+\-<>=&|]/;
    var punctuationChars = /[{}\(\),;\[\]]/;

    function tokenBase(stream, state) {
      var ch = stream.next();
      curPunc = null;
      if (ch === '$' || ch === '?') {
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
        ch2 = stream.next();
        if (ch2 === '-') {
          stream.skipToEnd();
          return 'comment';
        }
      } else if (operatorChars.test(ch)) {
        stream.eatWhile(operatorChars);
        return null;
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
        } else if (/[\]\}\)]/.test(curPunc)) {
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
          if (/[\}\]]/.test(state.context.type)) {
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
        if (/[\]\}]/.test(firstChar)) {
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

  CodeMirror.defineMIME('text/x-bqsql', 'bqsql');
});