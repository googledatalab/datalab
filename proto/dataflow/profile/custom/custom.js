// Custom.js
//

$(function() {
  function hiddenLineFormatter(n) { return ''; }
  function stringLineFormatter(n) { return n.toString(); }

  // load CodeMirror mode for Java
  $.getScript('/static/components/codemirror/mode/clike/clike.js');

  // Configure CodeMirror settings
  var cmConfig = IPython.CodeCell.options_default.cm_config;
  cmConfig.mode = 'text/x-java';
  cmConfig.indentUnit = 2;
  cmConfig.smartIndent = true;
  cmConfig.autoClearEmptyLines = true;
  cmConfig.gutter = true;
  cmConfig.fixedGutter = true;
  cmConfig.lineNumbers = true;
  cmConfig.lineNumberFormatter = hiddenLineFormatter;

  var codeCellProto = IPython.CodeCell.prototype;

  var originalJSONConverter = codeCellProto.toJSON;
  var originalExecuteReplyHandler = codeCellProto._handle_execute_reply;
  var originalSelectHandler = codeCellProto.select;
  var originalUnselectHandler = codeCellProto.unselect;

  // Override JSON conversion to switch the language identifier.
  codeCellProto.toJSON = function() {
    var data = originalJSONConverter.apply(this);
    data.language = 'java';

    return data;
  }

  // Override execute handler on code cells to copy metadata from ijava kernel into
  // cell metadata.
  codeCellProto._handle_execute_reply = function(msg) {
    originalExecuteReplyHandler.call(this, msg);

    var metadata = msg.metadata;
    for (var n in metadata) {
      if (n.indexOf('ijava.') === 0) {
        this.metadata[n] = metadata[n];
      }
    }
  }

  // Override select and unselect handlers to toggle display of line numbers.
  codeCellProto.select = function() {
    if (originalSelectHandler.apply(this)) {
      this.code_mirror.setOption('lineNumberFormatter', stringLineFormatter);
      return true;
    }
    return false;
  }
  codeCellProto.unselect = function() {
    if (originalUnselectHandler.apply(this)) {
      this.code_mirror.setOption('lineNumberFormatter', hiddenLineFormatter);
      return true;
    }
    return false;
  }
});

require.config({
  paths: {
    d3: 'http://d3js.org/d3.v3.min',
    dagred3: 'http://cpettitt.github.io/project/dagre-d3/latest/dagre-d3',
    static: '/static/custom'
  }
});

