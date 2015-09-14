/*
 * Copyright 2014 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var debug = {
  enabled: true,
  log: function() { console.log.apply(console, arguments); }
};

function placeHolder() {}

// Install Google Analytics - this is the standard tracking code, reformatted.
(function(i, s, o, g, r, a, m) {
  i['GoogleAnalyticsObject'] = r;
  i[r] = i[r] || function() {
    (i[r].q = i[r].q || []).push(arguments)
  };
  i[r].l = 1 * new Date();
  a = s.createElement(o);
  m = s.getElementsByTagName(o)[0];
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m)
})(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

// Override WebSocket
(function() {
  if (!window.io) {
    // If socket.io was not loaded into the page, then do not override the existing
    // WebSocket functionality.
    return;
  }

  function WebSocketShim(url) {
    var self = this;
    this._url = url;
    this.readyState = WebSocketShim.CLOSED;

    var socketUri = location.protocol + '//' + location.host + '/session';
    var socketOptions = {
      upgrade: false,
      multiplex: false
    };

    var socket = io.connect(socketUri, socketOptions);
    socket.on('connect', function() {
      socket.emit('start', { url: url });
    });
    socket.on('disconnect', function() {
      self._socket = null;
      self.readyState = WebSocketShim.CLOSED;
      if (self.onclose) {
        self.onclose({ target: self });
      }
    });
    socket.on('open', function(msg) {
      self._socket = socket;
      self.readyState = WebSocketShim.OPEN;
      if (self.onopen) {
        self.onopen({ target: self });
      }
    });
    socket.on('close', function(msg) {
      self._socket = null;
      self.readyState = WebSocketShim.CLOSED;
      if (self.onclose) {
        self.onclose({ target: self });
      }
    });
    socket.on('data', function(msg) {
      if (self.onmessage) {
        self.onmessage({ target: self, data: msg.data });
      }
    });
  }
  WebSocketShim.prototype = {
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,

    send: function(data) {
      if (this.readyState != WebSocketShim.OPEN) {
        throw new Error('WebSocket is not yet opened');
      }
      this._socket.emit('data', { data: data });
    },

    close: function() {
      if (this.readyState == WebSocketShim.OPEN) {
        this.readyState = WebSocketShim.CLOSED;

        this._socket.emit('stop', { url: this._url });
        this._socket.close();
      }
    }
  };
  WebSocketShim.CLOSED = 0;
  WebSocketShim.OPEN = 1;

  var nativeWebSocket = window.WebSocket;
  window.WebSocket = WebSocketShim;
})();


function initializePage(dialog) {
  function anonymizeString(s) {
    return s.slice(0, 1) + (s.length - 2) + s.substr(-1);
  }

  function getAnonymizedPath() {
    try {
      var path = location.pathname;
      return '/' + path.substr(1).split('/').map(anonymizeString).join('/')
    }
    catch (e) {
      return '/error';
    }
  }

  function getAnonymizedTitle() {
    try {
      return anonymizeString(document.title || 'untitled');
    }
    catch (e) {
      return '';
    }
  }

  function showAbout() {
    var version = document.body.getAttribute('data-version-id');
    var dialogContent =
      '<p>Interactive notebooks, with Python and SQL on Google Cloud Platform.</p>' +
      '<p>Explore, transform, visualize and process data using BigQuery and Google Cloud Storage.</p><br />' +
      '<pre>Version: ' + version  + '\nBased on Jupyter (formerly IPython) 4</pre>' +
      '<h5><b>More Information</b></h5>' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="https://cloud.google.com" target="_blank">Product information</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="https://github.com/GoogleCloudPlatform/datalab" target="_blank">Project on GitHub</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="/static/about.txt" target="_blank">License and software information</a>';

    var dialogOptions = {
      title: 'About Google Cloud Datalab',
      body: $(dialogContent),
      buttons: { 'OK': {} }
    };
    dialog.modal(dialogOptions);
  }

  function captureFeedback() {
    var feedbackId = document.body.getAttribute('data-feedback-id');
    if (window.userfeedback) {
      var feedbackOptions = {
        productId: feedbackId,
        productVersion: document.body.getAttribute('data-version-id'),
        bucket: 'beta',
        authuser: document.body.getAttribute('data-user-id')
      };
      var productInfo = {
        projectNumber: document.body.getAttribute('data-project-num'),
        instanceId: document.body.getAttribute('data-instance-id')
      };
      window.userfeedback.api.startFeedback(feedbackOptions, productInfo);
    }
  }

  $('#aboutButton').click(showAbout);
  $('#feedbackButton').click(captureFeedback);

  // TODO(Jupyter): Validate these links
  var projectId = document.body.getAttribute('data-project-id');
  var consoleLink = 'https://console.developers.google.com/project/' + projectId;
  var instancesLink = consoleLink + '/appengine/versions?moduleId=datalab';
  var repoLink = consoleLink + '/clouddev/develop/browse';

  document.getElementById('consoleLink').href = consoleLink;
  document.getElementById('instancesLink').href = instancesLink;
  document.getElementById('repoLink').href = repoLink;
  document.getElementById('userId').textContent = document.body.getAttribute('data-user-id');

  // TODO(Jupyter): Validate GA works...
  var analyticsId = document.body.getAttribute('data-analytics-id');
  if (analyticsId) {
    var domain = 'datalab.cloud.google.com';
    var projectNumber = document.body.getAttribute('data-project-num');
    var version = document.body.getAttribute('data-version-id');
    var instance = document.body.getAttribute('data-instance-id');
    var userId = document.body.getAttribute('data-user-hash');

    var dimensions = {
      dimension1: projectNumber,
      dimension2: version,
      dimension3: instance,
      dimension4: userId
    };

    ga('create', analyticsId, {
      cookieDomain: domain
    });
    ga('set', dimensions);
    ga('set', 'hostname', domain);
    ga('send', 'pageview', {
      page: getAnonymizedPath(),
      title: getAnonymizedTitle()
    });
  }
}

function initializeNotebookApplication(ipy, notebook, events, dialog, utils) {
  // Various RequireJS additions used for notebook functionality
  require.config({
    paths: {
      extensions: '/static/extensions',
      d3: '//cdnjs.cloudflare.com/ajax/libs/d3/3.4.13/d3',
      element: '/static/require/element',
      style: '/static/require/style',
      visualization: '/static/require/visualization'
    }
  });

  function DataLab() {
    this.session = new DataLabSession();
  }

  function DataLabSession() {
  }
  DataLabSession.prototype.execute = function(code, callback) {
    function shellHandler(reply) {
      if (callback) {
        var content = reply.content;
        if (!content || (content.status != 'ok')) {
          callback(new Error('Unable to retrieve values.'), null);
          callback = null;
        }
      }
    }

    function iopubHandler(output) {
      if (output.msg_type == 'stream') {
        debug.log(output.content.text);
        return;
      }

      if (callback) {
        var values = null;
        var error = null;
        try {
          if (output.msg_type == 'execute_result') {
            values = output.content.data['application/json'];
          }
        }
        catch (e) {
          error = e;
        }

        if (values) {
          callback(null, values);
        }
        else {
          callback(error || new Error('Unexpected value data retrieved.'), null);
        }
        callback = null;
      }
    }

    try {
      var callbacks = {
        shell: { reply: shellHandler },
        iopub: { output: iopubHandler }
      };
      notebook.kernel.execute(code, callbacks, { silent: false, store_history: false });
    }
    catch (e) {
      callback(e, null);
    }
  }

  window.datalab = new DataLab();


  require(['notebook/js/notebook'], function(ipy) {
    var notebook = ipy.Notebook;
    notebook.prototype.list_checkpoints = placeHolder;
    notebook.prototype.create_checkpoint = placeHolder;

    var originalFromJSON = notebook.prototype.fromJSON;
    notebook.prototype.fromJSON = function(data) {
      // This is a hack to turn notebooks as trusted... this is necessary to allow editing
      // of notebooks in multiple contexts (multiple developers, multiple development VMs, etc.)
      // The assumption is the developer explicitly trusts anything they add to their
      // development environment.
      data.content.cells.forEach(function(cell) {
        if (cell.cell_type == 'code') {
          cell.metadata.trusted = true;
        }
      });

      originalFromJSON.apply(this, [ data ]);
    }
  });

  require(['notebook/js/menubar'], function(ipy) {
    ipy.MenuBar.prototype.add_kernel_help_links = placeHolder;
  });

  require(['notebook/js/textcell'], function(ipy) {
    var markdownCell = ipy.MarkdownCell;
    markdownCell.options_default.placeholder = 'Double-click here to enter some markdown text...';
  });

  require(['notebook/js/codecell'], function(ipy) {
    var codeCell = ipy.CodeCell;
    var codeCellProto = codeCell.prototype;

    codeCell.input_prompt_function = function(prompt_value) {
      if ((prompt_value === undefined) || (prompt_value === null)) {
        prompt_value = '&nbsp;';
      }

      return '[' + prompt_value + ']';
    }

    var originalSelectHandler = codeCellProto.select;
    var originalUnselectHandler = codeCellProto.unselect;

    // Override select and unselect handlers to toggle display of line numbers.
    function hiddenLineFormatter(n) { return ''; }
    function stringLineFormatter(n) { return n.toString(); }

    codeCellProto.select = function() {
      if (originalSelectHandler.apply(this)) {
        this.code_mirror.setOption('lineNumberFormatter', stringLineFormatter);
        this.celltoolbar.show();
        return true;
      }
      return false;
    }
    codeCellProto.unselect = function(leave_selected) {
      if (originalUnselectHandler.apply(this, [ leave_selected ])) {
        this.code_mirror.setOption('lineNumberFormatter', hiddenLineFormatter);
        this.celltoolbar.hide();
        return true;
      }
      return false;
    }

    // Configure CodeMirror settings
    var codeConfig = codeCell.options_default.cm_config;
    codeConfig.indentUnit = 2;
    codeConfig.smartIndent = true;
    codeConfig.autoClearEmptyLines = true;
    codeConfig.styleActiveLine = true;
    codeConfig.gutter = true;
    codeConfig.fixedGutter = true;
    codeConfig.lineNumbers = true;
    codeConfig.lineNumberFormatter = hiddenLineFormatter;

    codeCell.config_defaults.highlight_modes.magic_javascript.reg = [
      /^%%javascript/,
      /^%%bigquery udf/
    ];

    require(['codemirror/mode/sql/sql'], function() {
      codeCell.config_defaults.highlight_modes['magic_text/x-sql'] = {
        reg: [ /^%%sql/ ]
      };
    });
  });

  function navigateAlternate(alt, download) {
    var url = document.location.href.replace('/notebooks', alt);
    if (download) {
      url = url.replace('.ipynb', '.ipynb?download=true');
    }

    if (notebook.dirty) {
      var w = window.open('');
      notebook.save_notebook().then(function() {
        w.location = url;
      });
    }
    else {
      window.open(url);
    }
  }

  $('#saveButton').click(function() {
    notebook.save_notebook();
  })

  $('#saveCopyButton').click(function() {
    notebook.copy_notebook();
  })

  $('#renameButton').click(function() {
    notebook.save_widget.rename_notebook({ notebook: notebook });
  })

  $('#downloadButton').click(function() {
    navigateAlternate('/files', /* download */ true);
  })

  $('#convertHTMLButton').click(function() {
    navigateAlternate('/nbconvert/html');
  })

  $('#convertPythonButton').click(function() {
    navigateAlternate('/nbconvert/python');
  })

  $('#addCodeCellButton').click(function() {
    this.blur();

    notebook.insert_cell_below('code');
    notebook.select_next();
    notebook.focus_cell();
    notebook.edit_mode();
  });

  $('#addMarkdownCellButton').click(function() {
    this.blur();

    notebook.insert_cell_below('markdown');
    notebook.select_next();
    notebook.focus_cell();
    notebook.edit_mode();
  });

  $('#deleteCellButton').click(function() {
    notebook.delete_cell();
    this.blur();
  });

  $('#moveCellUpButton').click(function() {
    notebook.move_cell_up();
    this.blur();
  })

  $('#moveCellDownButton').click(function() {
    notebook.move_cell_down();
    this.blur();
  });

  $('#runButton').click(function() {
    notebook.execute_cell_and_select_below();
    this.blur();
  });

  $('#runAllButton').click(function() {
    notebook.execute_all_cells();
    this.blur();
  });

  $('#runToButton').click(function() {
    notebook.execute_cells_above();
    this.blur();
  });

  $('#runFromButton').click(function() {
    notebook.execute_cells_below();
    this.blur();
  });

  $('#clearButton').click(function() {
    notebook.clear_output();
    this.blur();
  });

  $('#clearAllButton').click(function() {
    notebook.clear_all_output();
    this.blur();
  });

  $('#resetSessionButton').click(function() {
    notebook.restart_kernel();
    this.blur();
  });

  $('#toggleSidebarButton').click(function() {
    document.getElementById('sidebarArea').classList.toggle('larger');
    document.getElementById('toggleSidebarButton').classList.toggle('fa-flip-horizontal');
    this.blur();
  });

  $('#keyboardHelpLink').click(function(e) {
    showHelp(document.getElementById('shortcutsHelp').textContent);
    e.preventDefault();
  });

  $('#markdownHelpLink').click(function(e) {
    showHelp(document.getElementById('markdownHelp').textContent);
    e.preventDefault();
  });

  $('#navigationButton').click(function() {
    showNavigation();
    this.blur();
  });

  $('#helpButton').click(function() {
    showHelp();
    this.blur();
  });

  $('#navigation').click(function(e) {
    var index = e.target.getAttribute('cellIndex');
    if (index !== null) {
      var cell = notebook.get_cells()[index];

      var scrollable = $('#mainContent');
      var scrollTop = scrollable.scrollTop() - scrollable.offset().top +
                      cell.element.offset().top;
      scrollable.animate({ scrollTop: scrollTop }, 250);
    }
    e.preventDefault();
  });

  function showNavigation() {
    document.getElementById('navigation').style.display = '';
    document.getElementById('help').style.display = 'none';

    document.getElementById('navigationButton').classList.add('active');
    document.getElementById('helpButton').classList.remove('active');
  }

  function showHelp(markup) {
    document.getElementById('navigation').style.display = 'none';
    document.getElementById('help').style.display = '';

    document.getElementById('navigationButton').classList.remove('active');
    document.getElementById('helpButton').classList.add('active');

    if (markup) {
      document.getElementById('help').innerHTML = markup;
    }
  }

  function updateNavigation() {
    var content = [];
    var prefixes = [ '', '&nbsp;&nbsp;&nbsp;', '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' ];

    function createOutlineItem(level, text, index) {
      if (level == 1) {
        content.push('<br />');
      }
      content.push('<div>');
      content.push(prefixes[level - 1]);
      content.push('<a href="#" cellIndex="' + index + '">');
      content.push(text);
      content.push('</a></div>');
      content.push('')
    }

    content.push('<div><b>Notebook Outline</b></div>');

    var headers = 0;
    var cells = notebook.get_cells();
    cells.forEach(function(c, i) {
      if (c.cell_type != 'markdown') {
        return;
      }

      var lines = c.get_text().split('\n');
      lines.forEach(function(line) {
        var level = 0;
        if (line.indexOf('### ') == 0) {
          level = 3;
        }
        else if (line.indexOf('## ') == 0) {
          level = 2
        }
        else if (line.indexOf('# ') == 0) {
          level = 1;
        }

        if (level != 0) {
          var header = line.substr(level + 1);
          createOutlineItem(level, header, i);

          headers++;
        }
      });
    });

    if (!headers) {
      content.push('<br /><div><i>Create headings in markdown cells to easily navigate to different parts of your notebook.</i></div>');
    }

    var markup = content.join('');
    $('#navigation').html(markup);
  }

  events.on('notebook_loaded.Notebook', function() {
    events.on('set_dirty.Notebook', function(e) {
      updateNavigation();
    });
    events.on('command_mode.Cell', function(e) {
      updateNavigation();
    });

    updateNavigation();
  });
  events.on('open_with_text.Pager', function(e, payload) {
    var help = payload.data['text/html'];
    if (!help) {
      help = payload.data['text/plain'];
      if (!help) {
        return;
      }

      help = utils.fixCarriageReturn(utils.fixConsole(help)).replace(/\n/g, '<br />');
    }

    document.getElementById('help').innerHTML = help;
    showHelp();
  });

  // TODO(Jupyter): Implement help menu dropdown shortcuts
}


function initializeNotebookList(ipy, notebookList, newNotebook, events, dialog, utils) {
  function showContent(e) {
    document.getElementById('notebooks').classList.add('active');
    document.getElementById('running').classList.remove('active');
    e.target.blur();
  }

  function showSessions(e) {
    document.getElementById('notebooks').classList.remove('active');
    document.getElementById('running').classList.add('active');
    e.target.blur();
  }

  function addNotebook(e) {
    newNotebook.new_notebook();
    e.target.blur();
  }

  function addFolder(e) {
    notebookList.contents.new_untitled(notebookList.notebook_path || '', {type: 'directory'})
      .then(function(){
        notebookList.load_list();
      }).catch(function (e) {
        dialog.modal({
            title: 'Creating Folder Failed',
            body: $('<div/>')
                    .text("An error occurred while creating a new folder.")
                    .append($('<div/>')
                    .addClass('alert alert-danger')
                    .text(e.message || e)),
            buttons: {
              OK: { 'class': 'btn-primary' }
            }
        });
      });
    e.target.blur();
  }

  document.getElementById('contentButton').addEventListener('click', showContent, false);
  document.getElementById('sessionsButton').addEventListener('click', showSessions, false);

  document.getElementById('addNotebookButton').addEventListener('click', addNotebook, false);
  document.getElementById('addFolderButton').addEventListener('click', addFolder, false);

  document.getElementById('repoLink2').href = document.getElementById('repoLink').href;
}


require(['base/js/namespace', 'base/js/events', 'base/js/dialog', 'base/js/utils'], function(ipy, events, dialog, utils) {
  initializePage(dialog);

  var pageClass = document.body.className;
  if (pageClass.indexOf('notebook_app') >= 0) {
    initializeNotebookApplication(ipy, ipy.notebook, events, dialog, utils);
  }
  else if (pageClass.indexOf('notebook_list') >= 0) {
    initializeNotebookList(ipy, ipy.notebook_list, ipy.new_notebook_widget, events, dialog, utils);
  }
});
