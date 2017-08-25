define(['appbar', 'minitoolbar', 'idle-timeout', 'util'], function(appbar, minitoolbar, idleTimeout, util) {
  function preLoad(ipy, notebook, events, dialog, utils) {
    // Various RequireJS additions used for notebook functionality
    require.config({
      paths: {
        extensions: 'extensions',
        d3: '//cdnjs.cloudflare.com/ajax/libs/d3/3.4.13/d3',
        element: 'require/element',
        style: 'require/style',
        visualization: 'require/visualization',
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
      var cells = Jupyter.notebook.get_cells();
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

    $([IPython.events]).on('app_initialized.NotebookApp', function(){
      // Bind Alt-Z to undo cell deletion.
      IPython.keyboard_manager.command_shortcuts.add_shortcut('Alt-z',
          Jupyter.notebook.undelete_cell.bind(Jupyter.notebook))
    });

    datalab.set_kernel = (newKernel) => {
      const currentKernal = Jupyter.notebook.kernel.name;
      if (newKernel !== currentKernal) {
        $('#currentKernelName').text('...');
        Jupyter.kernelselector.set_kernel(newKernel);
      }
    };

    events.on('kernel_connected.Kernel', function() {
      $('#currentKernelName').text(Jupyter.kernelselector.current_selection);
      $('#kernelSelectorDropdown').empty();
      Object.keys(Jupyter.kernelselector.kernelspecs).forEach(function(kernel) {
        $('#kernelSelectorDropdown').append(`
          <li>
            <a href="#" onclick="datalab.set_kernel('` + kernel + `')">
              ` + kernel + `
            </a>
          </li>
          `
          )
      })
    });

    idleTimeout.setupKernelBusyHeartbeat();
    $('#mainArea').scroll(idleTimeout.notebookScrolled);

    events.on('notebook_loaded.Notebook', function() {

      // create the cell toolbar
      Jupyter.notebook.get_cells().forEach(function(cell) {
        if (cell.cell_type === 'code')
          minitoolbar.addCellMiniToolbar(cell)
      });

      // patch any cell created from now on
      events.on('create.Cell', function(e, params) {
        minitoolbar.addCellMiniToolbar(params.cell);
      });

      events.on('set_dirty.Notebook', function(e) {
        updateNavigation();
      });

      events.on('command_mode.Cell', function(e) {
        updateNavigation();
      });

      updateNavigation();
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
        reg: [ /%%?sql\b/ ]
      };
      codeCell.config_defaults.highlight_modes['magic_text/bigquery'] = {
        reg: [ /%%?bq\s+query\b/ ]
      };
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

      appbar.showHelp(help);
    });
  }

  function postLoad(ipy, notebook, events, dialog, utils) {
    function DataLabSession() {
    }

    DataLabSession.prototype.is_connected = function() {
      return Jupyter.notebook.kernel && Jupyter.notebook.kernel.is_connected();
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
              if (!values) {
                values = output.content.data['text/plain'];
              }
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
        Jupyter.notebook.kernel.execute(code, callbacks, { silent: false, store_history: false });
      }
      catch (e) {
        callback(e, null);
      }
    }

    window.datalab.session = new DataLabSession();

    require(['notebook/js/notebook'], function(ipy) {
      var notebook = ipy.Notebook;

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

      function isSample() {
        var path = util.datalabSubPath(window.location.pathname);
        var lastSepPos = path.lastIndexOf('/');
        return lastSepPos >= 23 &&
            path.substring(lastSepPos-23, lastSepPos) == '/datalab/docs/notebooks';
      }

      // Remove save and rename menu items if under our docs directory.
      if (isSample()) {
        // Can't just hide them as they will get redisplayed on drop down, so we
        // strip their content.
        document.getElementById('saveButton').innerHTML = '';
        document.getElementById('renameButton').innerHTML = '';
      }

      // A replacement notebook copy function that makes copies in the root if
      // the source is under datalab/.
      notebook.prototype.copy_notebook = function() {
        var that = this;
        var base_url = this.base_url;
        var w = window.open('', IPython._target);
        var parent = utils.url_path_split(this.notebook_path)[0];
        if (isSample()) {
          var path = util.datalabSubPath(window.location.pathname);
          var lastSepPos = path.lastIndexOf('/');
          // Strip off leading /notebooks/ and trailing sample path to get datalab
          // path, then add /notebooks.
          parent = path.substring(11, lastSepPos-14) + 'notebooks';
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

      // This is just a copy of the one from Jupyter but changes the first
      // line from this.element.find('restore_checkpoint') to
      // $('#restoreButton').
      ipy.MenuBar.prototype.update_restore_checkpoint = function(checkpoints) {
          var ul = $('#restoreButton').find("ul");
          ul.empty();
          if (!checkpoints || checkpoints.length === 0) {
              ul.append(
                  $("<li/>")
                  .addClass("disabled")
                  .append(
                      $("<a/>")
                      .text("No checkpoints")
                  )
              );
              return;
          }

          var that = this;
          checkpoints.map(function (checkpoint) {
              var d = new Date(checkpoint.last_modified);
              ul.append(
                  $("<li/>").append(
                      $("<a/>")
                      .attr("href", "#")
                      .text(moment(d).format("LLLL"))
                      .click(function () {
                          that.notebook.restore_checkpoint_dialog(checkpoint);
                      })
                  )
              );
    });
      };
    });

    require(['notebook/js/textcell'], function(ipy) {
      var markdownCell = ipy.MarkdownCell;
      markdownCell.options_default.placeholder = 'Double-click here to enter some markdown text...';
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

    require (["notebook/js/outputarea"], function(ipy) {
      ipy.OutputArea.auto_scroll_threshold = 1000;
    });

    function removeCompletedMarks() {
      Jupyter.notebook.get_cells().forEach(function(cell) {
        cell.element.removeClass('completed');
      });
    }

    function navigateAlternate(alt, download) {
      var url = document.location.href.replace('/notebooks', alt);
      if (download) {
        url = url.replace('.ipynb', '.ipynb?download=true');
      }

      if (Jupyter.notebook.dirty) {
        var w = window.open('');
        Jupyter.notebook.save_notebook().then(function() {
          w.location = url;
        });
      }
      else {
        window.open(url);
      }
    }

    $('#saveButton').click(function() {
      Jupyter.notebook.save_checkpoint();
    })

    $('#saveCopyButton').click(function() {
      Jupyter.notebook.copy_notebook();
    })

    $('#renameButton').click(function() {
      Jupyter.notebook.save_widget.rename_notebook({ notebook: notebook });
    })

    $('#restoreButton').click(function() {
      Jupyter.notebook.restore_checkpoint();
    })

    $('#downloadButton').click(function() {
      navigateAlternate('/files', /* download */ true);
    })

    $('#convertHTMLButton').click(function() {
      var event = {
        'event': 'concordEvent',
        'pagePath': '/virtual/datalab/exportNotebook',
        'eventType': 'datalab',
        'eventName': 'exportNotebook',
        'metadata': 'format=html',
      }
      util.reportEvent(event);

      navigateAlternate('/nbconvert/html');
    })

    $('#convertPythonButton').click(function() {
      var event = {
        'event': 'concordEvent',
        'pagePath': '/virtual/datalab/exportNotebook',
        'eventType': 'datalab',
        'eventName': 'exportNotebook',
        'metadata': 'format=py',
      }
      util.reportEvent(event);

      navigateAlternate('/nbconvert/python');
    })

    $('#addCodeCellButton').click(function() {
      this.blur();

      Jupyter.notebook.insert_cell_below('code');
      Jupyter.notebook.select_next();
      Jupyter.notebook.focus_cell();
      Jupyter.notebook.edit_mode();
    });

    $('#addMarkdownCellButton').click(function() {
      this.blur();

      Jupyter.notebook.insert_cell_below('markdown');
      Jupyter.notebook.select_next();
      Jupyter.notebook.focus_cell();
      Jupyter.notebook.edit_mode();
    });

    $('#deleteCellButton').click(function() {
      Jupyter.notebook.delete_cell();
      this.blur();
    });

    $('#moveCellUpButton').click(function() {
      Jupyter.notebook.move_cell_up();
      this.blur();
    })

    $('#moveCellDownButton').click(function() {
      Jupyter.notebook.move_cell_down();
      this.blur();
    });

    $('#runButton').click(function() {
      Jupyter.notebook.execute_cell_and_select_below();
      this.blur();
    });

    $('#runAllButton').click(function() {
      Jupyter.notebook.execute_all_cells();
      this.blur();
    });

    $('#runToButton').click(function() {
      Jupyter.notebook.execute_cells_above();
      this.blur();
    });

    $('#runFromButton').click(function() {
      Jupyter.notebook.execute_cells_below();
      this.blur();
    });

    $('#clearButton').click(function() {
      Jupyter.notebook.clear_output();
      this.blur();
    });

    $('#clearAllButton').click(function() {
      Jupyter.notebook.clear_all_output();
      this.blur();
    });

    $('#resetSessionButton').click(function() {
      Jupyter.notebook.restart_kernel()
        .then(success => removeCompletedMarks());
      this.blur();
    });

    $('#interruptKernelButton').click(function() {
      Jupyter.notebook.kernel.interrupt();
      this.blur();
    });

    $('#toggleSidebarButton').click(function() {
      $('#sidebarArea').toggleClass('larger');
      rotated = $('#toggleSidebarButton').css('transform').indexOf('matrix') > -1;
      $('#toggleSidebarButton').css('transform', rotated ? '' : 'rotate(180deg)');
      this.blur();
    });

    $('#hideSidebarButton').click(function() {
      appbar.toggleSidebar();
    });

    $('#navigationButton').click(function() {
      if (document.getElementById('sidebarArea').style.display == 'none') {
        appbar.toggleSidebar();
      }
      showNavigation();
      this.blur();
    });

    $('#navigation').click(function(e) {
      var index = e.target.getAttribute('cellIndex');
      if (index !== null) {
        var cell = Jupyter.notebook.get_cells()[index];

        var scrollable = $('#mainArea');
        var scrollTop = scrollable.scrollTop() - scrollable.offset().top +
                        cell.element.offset().top;
        scrollable.animate({ scrollTop: scrollTop }, 250);
      }
      e.preventDefault();
    });

    function showNavigation() {
      document.getElementById('navigation').style.display = '';
      document.getElementById('help').style.display = 'none';
    }

  }

  return {
    preLoad: preLoad,
    postLoad, postLoad,
  };
});



