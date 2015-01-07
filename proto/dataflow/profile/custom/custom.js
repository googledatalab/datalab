// Custom.js
//

// RequireJS configuration to add various paths in support of extensions
// and common scripts used.
require.config({
  paths: {
    d3: '//cdnjs.cloudflare.com/ajax/libs/d3/3.5.3/d3.min',
    extensions: '/static/content/extensions'
  }
});

// Kernel related functionality
$(function() {
  IPython.Kernel.prototype.get_data = function(code, callback) {
    function shellHandler(reply) {
      var content = reply.content;
      if (!content || (content.status != 'ok')) {
        callback(null, new Error('Unable to retrieve values.'));
        callback = null;
      }
    }

    function iopubHandler(output) {
      if (!callback) {
        return;
      }

      var values = null;
      var error = null;
      try {
        var data = output.content ? output.content.data : null;
        if (data) {
          var values = data['application/json'];
          if (values) {
            values = JSON.parse(values);
          }
        }
      }
      catch(e) {
        error = e;
      }

      if (values) {
        callback(values);
      }
      else {
        callback(null, error || new Error('Unexpected value data retrieved.'));
      }
      callback = null;
    }

    try {
      var callbacks = {
        shell: { reply: shellHandler },
        iopub: { output: iopubHandler }
      };
      this.execute(code, callbacks, { silent: false, store_history: false });
    }
    catch (e) {
      callback(null, e);
    }
  };
});

// CodeCell and CodeMirror related functionality
$(function() {
  function hiddenLineFormatter(n) { return ''; }
  function stringLineFormatter(n) { return n.toString(); }

  // load CodeMirror modes
  $.getScript('/static/components/codemirror/mode/clike/clike.js');
  $.getScript('/static/components/codemirror/mode/clike/javascript.js');

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

  // %%json and %%text cell support
  IPython.config.cell_magic_highlight['magic_application/ld+json'] = {
    reg: [ /%%json/ ]
  };
  IPython.config.cell_magic_highlight['magic_text/plain'] = {
    reg: [ /%%text/ ]
  };

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

