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

var debug = {
  enabled: true,
  log: function() { console.log.apply(console, arguments); }
};

function placeHolder() {}

function initializePage(dialog) {

  function showAbout() {
    var version = document.body.getAttribute('data-version-id');
    var dialogContent =
      '<p>Interactive notebooks, with Python and SQL on Google Cloud Platform.</p>' +
      '<p>Explore, transform, visualize and process data using BigQuery and Google Cloud Storage.</p><br />' +
      '<pre>Version: ' + version  + '\nBased on Jupyter (formerly IPython) 4</pre>' +
      '<h5><b>More Information</b></h5>' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="https://cloud.google.com" target="_blank">Product information</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="https://github.com/GoogleCloudPlatform/datalab" target="_blank">Project on GitHub</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="/static/about.txt" target="_blank">License and software information</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="https://cloud.google.com/terms/" target="_blank">Terms of Service</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="http://www.google.com/intl/en/policies/" target="_blank">Privacy Policy</a><br />';

    var dialogOptions = {
      title: 'About Google Cloud Datalab',
      body: $(dialogContent),
      buttons: { 'OK': {} }
    };
    dialog.modal(dialogOptions);
  }

  $('#aboutButton').click(showAbout);
  $('#feedbackButton').click(function() {
    window.open('https://groups.google.com/forum/#!newtopic/google-cloud-datalab-feedback');
  });

  if (document.getElementById('repoLink')) {
    // repoLink only exists in cloud version.
    var projectId = document.body.getAttribute('data-project-id');
    var instanceName = document.body.getAttribute('data-instance-name');
    var consoleLink = 'https://console.developers.google.com/project/' + projectId;
    var instancesLink = consoleLink + '/appengine/versions?moduleId=datalab';
    var repoLink = consoleLink + '/clouddev/develop/browse/default/datalab_' + instanceName;

    document.getElementById('consoleLink').href = consoleLink;
    document.getElementById('instancesLink').href = instancesLink;
    document.getElementById('repoLink').href = repoLink;
    document.getElementById('userId').textContent = document.body.getAttribute('data-user-id');
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
      visualization: '/static/require/visualization',
      jquery: '//ajax.googleapis.com/ajax/libs/jquery/2.0.0/jquery.min',
      plotly: 'https://cdn.plot.ly/plotly-1.5.1.min.js?noext'
    },
    shim: {
      plotly: {
        deps: ['d3', 'jquery'],
        exports: 'plotly'
      }
    }
  });

  function DataLabSession() {
  }

  DataLabSession.prototype.is_connected = function() {
    return notebook.kernel && notebook.kernel.is_connected();
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

  window.datalab.session = new DataLabSession();

  $([IPython.events]).on('app_initialized.NotebookApp', function(){
    // Bind Alt-Z to undo cell deletion.
    IPython.keyboard_manager.command_shortcuts.add_shortcut('Alt-z','ipython.undo-last-cell-deletion')
  });

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

      return originalFromJSON.apply(this, [ data ]);
    }

    // This is a hack to disable timestamp check due to a Workspace-sync bug.
    var originalSave = notebook.prototype.save_notebook;
    notebook.prototype.save_notebook = function() {
      return originalSave.apply(this, /* check_lastmodified */ [ false ]);
    }

    // A replacement notebook copy function that makes copies in the root if
    // the source is under datalab/.
    notebook.prototype.copy_notebook = function() {
      var that = this;
      var base_url = this.base_url;
      var w = window.open('', IPython._target);
      var parent = utils.url_path_split(this.notebook_path)[0];
      if (parent == 'datalab' || parent.startsWith('datalab/')) {
        parent = 'My Notebooks';
      }
      this.contents.copy(this.notebook_path, parent).then(
        function (data) {
          w.location = utils.url_join_encode(
            base_url, 'notebooks', data.path
          );
        },
        function(error) {
          w.close();
          that.events.trigger('notebook_copy_failed', error);
        }
      );
    };
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

    var statusContent = document.getElementById('cellStatus').text;
    codeCellProto.set_input_prompt = function(number) {
      this.input_prompt_number = number;

      if (number !== undefined) {
        if (number === null) {
        }
        else if (number == '*') {
          this.element.addClass('session');
          this.element.removeClass('completed');

          var status = $(statusContent);
          this.element.find('div.output').css('display', '').empty().append(status);
          status.delay(2000).show(0);
        }
        else {
          this.element.addClass('completed');
          var status = this.element.find('div.status');
          if (status) {
            status.remove();
          }
        }
      } else {
        var status = this.element.find('div.status');
        if (status) {
          status.remove();
        }
      }
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
    codeConfig.lineNumberFormatter = function(n) { return n.toString(); };

    codeCell.config_defaults.highlight_modes.magic_javascript.reg = [
      /^%%javascript/,
      /^%%bigquery udf/
    ];

    codeCell.config_defaults.highlight_modes['magic_text/sql'] = {
      reg: [ /^%%sql/ ]
    };
  });

  require(["services/kernels/kernel"], function(ipy) {
    var kernel = ipy.Kernel;

    var originalExecute = kernel.prototype.execute;
    kernel.prototype.execute = function (code, callbacks, options) {
      // If this is a line magic but has a non-empty cell body change it to a cell magic.
      if (code.length > 2 && code[0] == '%' && code[1] != '%') {
        var lines = code.split('\n');
        if (lines.length > 1) {
          for (var i = 1; i < lines.length; i++) {
            if (lines[i].trim().length > 0) {
              code = '%' + code;
              break;
            }
          }
        }
      }
      return originalExecute.apply(this, [ code, callbacks, options ]);
    }
  });

  /**
   * Patch the cell auto_highlight code to use a working mode for magic_ MIME types.
   * The Jupyter code uses a broken multiplexor. This _auto_highlight function is 
   * just the Jupyter code with the multiplexor stripped out and an overlay mode
   * put in instead. First we have a function to return the mode that works,
   * then we have the original Jupyter code with a call to our function replacing the
   * code that was broken.
   */

  function createMagicOverlayMode(magic_mode, spec) {
    CodeMirror.defineMode(magic_mode, function(config) {
      var magicOverlay = {
        startState: function() {
          return {firstMatched : false, inMagicLine: false}
        },
        token: function(stream, state) {
          if(!state.firstMatched) {
            state.firstMatched = true;
              if (stream.match("%%", false)) {
              state.inMagicLine = true;
            }
          }
          if (state.inMagicLine) {
            stream.eat(function any(ch) { return true; });
            if (stream.eol()) {
              state.inMagicLine = false;
            }
            return "magic";
          }
          stream.skipToEnd();
          return null;
        }
      };
      return CodeMirror.overlayMode(CodeMirror.getMode(config, spec), magicOverlay);
    });
  }

  require (["notebook/js/cell"], function(ipy) {

    var cell = ipy.Cell;

    cell.prototype._auto_highlight = function (modes) {
      /**
       *Here we handle manually selected modes
       */
      var that = this;
      var mode;
      if (this.user_highlight !== undefined && this.user_highlight != 'auto') {
        mode = this.user_highlight;
        CodeMirror.autoLoadMode(this.code_mirror, mode);
        this.code_mirror.setOption('mode', mode);
        return;
      }
      var current_mode = this.code_mirror.getOption('mode', mode);
      var first_line = this.code_mirror.getLine(0);
      // loop on every pairs
      for (mode in modes) {
        var regs = modes[mode].reg;
        // only one key every time but regexp can't be keys...
        for (var i=0; i<regs.length; i++) {
          // here we handle non magic_modes.
          // TODO :
          // On 3.0 and below, these things were regex.
          // But now should be string for json-able config.
          // We should get rid of assuming they might be already
          // in a later version of Jupyter.
          var re = regs[i];
          if (typeof(re) === 'string') {
            re = new RegExp(re)
          }
          if (first_line.match(re) !== null) {
            if (current_mode == mode) {
              return;
            }
            if (mode.search('magic_') !== 0) {
              utils.requireCodeMirrorMode(mode, function (spec) {
                that.code_mirror.setOption('mode', spec);
              });
              return;
            }
            var magic_mode = mode;
            mode = magic_mode.substr(6);
            if (current_mode == magic_mode) {
              return;
            }
            utils.requireCodeMirrorMode(mode, function (spec) {
              // Our change is here, replacing the original broken mode.
              createMagicOverlayMode(magic_mode, spec);
              that.code_mirror.setOption('mode', magic_mode);
            });
            return;
          }
        }
      }
      // fallback on default
      var default_mode;
      try {
        default_mode = this._options.cm_config.mode;
      } catch(e) {
        default_mode = 'text/plain';
      }
      if (current_mode === default_mode) {
        return;
      }
      this.code_mirror.setOption('mode', default_mode);
    };
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

  function toggleSidebar() {
    var d = document.getElementById('sidebarArea');
    d.style.display = (d.style.display == 'none') ? 'block' : 'none';
    document.getElementById('hideSidebarButton').classList.toggle('fa-flip-vertical');
    this.blur();
    // Chrome at least seems to render the notebook poorly after this for a little
    // while. If you scroll new content into view it is messed up until you click 
    // in the notebook. This does not repro with Firefox or Safari so seems to be
    // a Chrome bug. Triggering a resize or similar doesn't help because the content
    // that is messed up is currently out of the viewable part of the window. Will
    // file a bug against Chrome.
  }

  $('#hideSidebarButton').click(function() {
    toggleSidebar();
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
    if (document.getElementById('sidebarArea').style.display == 'none') {
      toggleSidebar();
    }
    showNavigation();
    this.blur();
  });

  $('#helpButton').click(function() {
    if (document.getElementById('sidebarArea').style.display == 'none') {
      toggleSidebar();
    }
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

  function browseRepository(e) {
    window.open(document.getElementById('repoLink').href, '_blank');
    e.target.blur();
  }

  document.getElementById('contentButton').addEventListener('click', showContent, false);
  document.getElementById('sessionsButton').addEventListener('click', showSessions, false);

  document.getElementById('addNotebookButton').addEventListener('click', addNotebook, false);
  document.getElementById('addFolderButton').addEventListener('click', addFolder, false);

  if (document.getElementById('repoButton')) {
    document.getElementById('repoButton').addEventListener('click', browseRepository, false);
  }

  (function buildBreadcrumbContent() {
    var path = location.pathname;

    // Strip off leading /tree and trailing / if present
    if (path.indexOf('/tree') == 0) {
      path = path.substr(5);
    }
    if (path.substr(-1) == '/') {
      path = path.substr(0, path.length - 1);
    }
    if (!path) {
      return;
    }

    var html = [];
    html.push('<ul class="breadcrumb">');
    html.push('<li><a href="/tree"><i class="fa fa-home"></i></a></li>');

    var segments = [];

    // Split the path into its segments, and convert into list items, ignoring the first
    // empty segment. Intermediate segments are also generated as navigation links.
    var pathParts = path.split('/');
    for (var i = 1; i < pathParts.length; i++) {
      var pathPart = pathParts[i];
      segments.push(pathPart);
      pathPart = decodeURIComponent(pathPart);

      var element;
      if (i == pathParts.length - 1) {
        element = '<li>' + pathPart + '</li>';
      }
      else {
        element = '<li><a href="/tree/' + segments.join('/') + '">' + pathPart + '</a></li>';
      }

      html.push(element);
    }

    html.push('</ul>');

    document.getElementById('project_name').innerHTML = html.join('');
  })();

  function checkVersion(versionInfo) {
    if (versionInfo == undefined) {
      return;
    }
    var vid = document.body.getAttribute('data-version-id');
    if (vid == undefined) {
      return;
    }
    var version = parseInt(vid.split('.')[2]);
    if (version >= versionInfo.latest) {
      return;
    }
    var instance = document.body.getAttribute('data-instance-name');
    var deployerLink = 'https://datalab.cloud.google.com?name=' + instance;
    var optional = (version >= versionInfo.last);
    var messageDiv = document.getElementById('updateMessageArea');
    var message = 'You are using DataLab 0.5.' + version + '. ' + 
        (optional ? 'An optional' : 'A recommended') + ' update (0.5.' + versionInfo.latest + 
        ') is <a href="' + deployerLink + 
        '"> available</a> (see <a href="https://github.com/GoogleCloudPlatform/datalab/wiki/Release-Info"' + 
        '>what\'s new)</a>.'
    messageDiv.innerHTML = message;
    messageDiv.classList.add('alert');
    messageDiv.classList.add(optional ? 'alert-warning' : 'alert-danger');
    messageDiv.style.display = 'block';
  }

  checkVersion(window.datalab.versions);

}


function initializeDataLab(ipy, events, dialog, utils, security) {
  initializePage(dialog);

  // Override the sanitizer - all notebooks within the user's repository are implicity
  // trusted, and there is no need to remove scripts from cell outputs of notebooks
  // with previously saved results.
  security.sanitize_html = function(html) {
    return html;
  }

  var pageClass = document.body.className;
  if (pageClass.indexOf('notebook_app') >= 0) {
    initializeNotebookApplication(ipy, ipy.notebook, events, dialog, utils);
  }
  else if (pageClass.indexOf('notebook_list') >= 0) {
    initializeNotebookList(ipy, ipy.notebook_list, ipy.new_notebook_widget, events, dialog, utils);
  }
}

require(['base/js/namespace', 'base/js/events', 'base/js/dialog', 'base/js/utils', 'base/js/security'],
        initializeDataLab);
