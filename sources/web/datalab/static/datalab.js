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

function shouldShimWebsockets() {
    return location.host.toLowerCase().substr(-12) === '.appspot.com';
}

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

	function errorHandler() {
	    if (self.onerror) {
		self.onerror({ target: self });
	    }
	}
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
	socket.on('error', errorHandler);
	socket.on('connect_error', errorHandler);
	socket.on('reconnect_error', errorHandler);
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

    if (shouldShimWebsockets()) {
        debug.log('Replacing native websockets with socket.io');
        window.nativeWebSocket = window.WebSocket;
        window.WebSocket = WebSocketShim;
    }
})();

function placeHolder() {}

function reportEvent(event) {
  var reportingEnabled = (document.body.getAttribute('data-reporting-enabled') == 'true');
  if (!reportingEnabled) { return; }

  var signedIn = (document.body.getAttribute('data-signed-in') == 'true');
  var additionalMetadata = 'signedIn=' + signedIn;
  if (event['metadata']) {
    event['metadata'] = event['metadata'] + ',' + additionalMetadata;
  } else {
    event['metadata'] = additionalMetadata;
  }
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(event);
}

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

function showHelp(markup) {
  document.getElementById('navigation').style.display = 'none';
  document.getElementById('help').style.display = '';

  document.getElementById('navigationButton').classList.remove('active');
  document.getElementById('helpButton').classList.add('active');

  if (markup) {
    document.getElementById('help').innerHTML = markup;
  }
  if (document.getElementById('sidebarArea').style.display == 'none') {
    toggleSidebar();
  }
}

function xhr(url, callback, method) {
  method = method || "GET";

  let request = new XMLHttpRequest();
  request.onreadystatechange = function() {
    if (request.readyState === 4 && request.status === 200) {
      callback.call(request);
    }
  }
  request.open(method, url);
  request.send();
}

function getSettingKeyAddress(setting) {
  return window.location.protocol + "//" + window.location.host + "/_settings?key=" + setting;
}

function restartDatalab() {
  var restartUrl = window.location.protocol + "//" + window.location.host + "/_restart";

  function redirect() {
    window.location = '/';
  }

  xhr(restartUrl, function(){
    // We redirect to signal to the user that the restart did something.
    // However, we have to delay that a bit to give Datalab time to restart.  
    window.setTimeout(redirect, 500);
  }, "POST");
}

function getVmInfo(callback) {
  if (window.datalab.vminfo) {
    callback(window.datalab.vminfo);
    return;
  }

  path = window.location.protocol + '//' + window.location.host + '/_info/vminfo';
  xhr(path, function() {
    try {
      vminfo = JSON.parse(this.responseText);
      window.datalab.vminfo = vminfo;
      callback(vminfo);
    } catch(e) {
      callback(null);
    }
  });
}

function manageVm() {
  getVmInfo(function(vminfo) {
    if (vminfo && vminfo.vm_name && vminfo.vm_zone) {
      window.open('https://console.cloud.google.com/compute/instancesDetail' +
          '/zones/' + vminfo.vm_zone +
          '/instances/' + vminfo.vm_name +
          '?project=' + vminfo.vm_project);
    } else {
      console.log('Error, could not retrieve VM information. Is this a google cloud VM?');
    }
  });
}

function stopVm() {
  let action = confirm('Stopping this VM will discard any unsaved state. Are you sure?');
  if (action === true) {
    path = window.location.protocol + '//' + window.location.host + '/_stopvm';
    xhr(path, null, 'POST');
  }
}

function initializePage(dialog, saveFn) {

  function showAbout() {
    var version = document.body.getAttribute('data-version-id');
    var reportingEnabled = (document.body.getAttribute('data-reporting-enabled') == 'true');
    var dialogContent =
      '<p>Interactive notebooks, with Python and SQL on Google Cloud Platform.</p>' +
      '<p>Explore, transform, visualize and process data using BigQuery and Google Cloud Storage.</p><br />' +
      '<pre>Version: ' + version  + '\nBased on Jupyter (formerly IPython) 4</pre>' +
      '<h5><b>More Information</b></h5>' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="https://cloud.google.com" target="_blank">Product information</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="https://github.com/googledatalab/datalab" target="_blank">Project on GitHub</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="/static/about.txt" target="_blank">License and software information</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="https://cloud.google.com/terms/" target="_blank">Terms of Service</a><br />' +
      '<span class="fa fa-external-link-square">&nbsp;</span><a href="http://www.google.com/intl/en/policies/" target="_blank">Privacy Policy</a><br />' +
      '<span class="fa fa-recycle">&nbsp;</span><a href="javascript:restartDatalab()">Restart Server</a><br />';

    var dialogOptions = {
      title: 'About Google Cloud Datalab',
      body: $(dialogContent),
      buttons: { 'OK': {} }
    };
    dialog.modal(dialogOptions);
  }

  // Prepare sign in/out UI
  $('#accountDropdownButton').on('click', function (event) {
    $(this).parent().toggleClass('open');
    if (window.datalab && window.datalab.session) {
      window.datalab.session.execute("datalab_project_id()", function(error, projectId) {
        if (error === null || error === undefined) {
          $('#projectLabel').text("Active project: " + projectId);
          $('#projectLabel').show();
        }
      });
    }
  });
  $('body').on('click', function (e) {
    if (!$('#accountDropdown').is(e.target)
        && $('#accountDropdown').has(e.target).length === 0
        && $('.open').has(e.target).length === 0
    ) {
        $('#accountDropdown').removeClass('open');
    }
  });
  var signedIn = document.body.getAttribute('data-signed-in');
  if (signedIn != undefined) {
    if (signedIn == "true") {
      $('#signOutGroup').show();
      var username = document.body.getAttribute('data-account');
      $("#usernameLabel").text("Signed in as " + username);
      if (username.indexOf('gserviceaccount.com') < 0) {
        $('#signOutButton').show();
      }
    } else {
      $('#signInButton').show();
    }
    $('#signInButton').click(function() {
      saveFn();
      window.location = '/signin?referer=' + encodeURIComponent(window.location);
    });
    $('#signOutButton').click(function() {
      saveFn();
      window.location = '/signout?referer=' + encodeURIComponent(window.location);
    });
    $('#ungitButton').click(function() {
      // Always open at the root of the notebooks repository
      const path = '/content/datalab/notebooks';
      const prefix = window.location.protocol + '//' + window.location.host;

      window.open(prefix + '/_proxy/8083/#/repository?path=' + path);
    });
  }

  getVmInfo(function() {
    if (vminfo && vminfo.vm_name) {
      $('#stopVmGroup').show();
      $('#vmName').text(vminfo.vm_name);
      $('#stopVmButton').click(stopVm);
    }
  });

  // More UI that relies on appbar load
  // Prepare the theme selector radio boxes
  lightThemeRadioOption = document.getElementById("lightThemeRadioOption")
  darkThemeRadioOption = document.getElementById("darkThemeRadioOption")

  // By default, check the light theme radio button
  // TODO: When we have support for default settings on server side, remove this
  lightThemeRadioOption.checked = true;
  darkThemeRadioOption.checked = false;
  xhr(getSettingKeyAddress("theme"), function() {
    lightThemeRadioOption.checked = this.responseText === "\"light\"";
    darkThemeRadioOption.checked = this.responseText === "\"dark\"";
  });
  lightThemeRadioOption.onclick = function() {
    setTheme("light");
    darkThemeRadioOption.checked = false;
  };
  darkThemeRadioOption.onclick = function() {
    setTheme("dark");
    lightThemeRadioOption.checked = false;
  };

  function setTheme(theme) {
    xhr(getSettingKeyAddress("theme") + "&value=" + theme, function() {
      // Reload the stylesheet by resetting its address with a random (time) version querystring
      sheetAddress = document.getElementById("themeStylesheet").href + "?v=" + Date.now()
      document.getElementById("themeStylesheet").setAttribute('href', sheetAddress);
    }, "POST");
  }

  // If inside a notebook, prepare notebook-specific help link inside the sidebar
  if (document.getElementById('sidebarArea') !== null) {
    $('#keyboardHelpLink').click(function(e) {
      showHelp(document.getElementById('shortcutsHelp').textContent);
      e.preventDefault();
    });
    $('#keyboardHelpLink').show()
    $('#markdownHelpLink').click(function(e) {
      showHelp(document.getElementById('markdownHelp').textContent);
      e.preventDefault();
    });
    $('#markdownHelpLink').show()
    $('#notebookHelpDivider').show()
  }
  $('#aboutButton').click(showAbout);
  $('#feedbackButton').click(function() {
    window.open('https://groups.google.com/forum/#!newtopic/google-cloud-datalab-feedback');
  });
}

// constants for minitoolbar operations
const CELL_METADATA_COLLAPSED = 'hiddenCell';
const COLLAPSE_BUTTON_CLASS = 'fa-compress';
const UNCOLLAPSE_BUTTON_CLASS = 'fa-expand';
const CELL_METADATA_CODE_COLLAPSED = 'codeCollapsed';
const COLLAPSE_CODE_BUTTON_CLASS = 'fa-code';
const UNCOLLAPSE_CODE_BUTTON_CLASS = 'fa-code';
const RUN_CELL_BUTTON_CLASS = 'fa-play';
const CLEAR_CELL_BUTTON_CLASS = 'fa-minus-square-o';

function toggleCollapseCell(cell) {
  isCollapsed = cell.metadata[CELL_METADATA_COLLAPSED] || false;
  if (isCollapsed) {
    uncollapseCell(cell);
  } else {
    collapseCell(cell);
  }
}

/**
 * Collapse entire cell
 */
function collapseCell(cell) {
  if (cell.cell_type !== 'code') {
    // can't collapse markdown cells
    return;
  }

  function getCollapsedCellHeader(cell) {
    dots = '';
    // add dots if the cell has more than one code line
    if (cell.element.find('pre.CodeMirror-line').length > 1)
      dots = '. . .';
    return '<div class="rendered_html">' + cell.element.find('pre.CodeMirror-line')[0].outerHTML + dots + '</div>';
  }

  cell.element.addClass('cellhidden');

  cell.element.find('div.widget-area').hide();
  cell.element.find('div.cellPlaceholder')[0].innerHTML = getCollapsedCellHeader(cell);
  collapseSpan = cell.element.find('span.glyph-collapse-cell').removeClass(COLLAPSE_BUTTON_CLASS);
  collapseSpan = cell.element.find('span.glyph-collapse-cell').addClass(UNCOLLAPSE_BUTTON_CLASS);
  collapseSpan = cell.element.find('span.title-collapse-cell')[0].innerText = 'Expand';

  cell.metadata[CELL_METADATA_COLLAPSED] = true;
}

/**
 * Uncollapse entire cell
 */
function uncollapseCell(cell) {
  cell.element.removeClass('cellhidden');

  widgetSubarea = cell.element.find('div.widget-subarea')[0];
  // show the widgets area only if there are widgets in it (has children nodes)
  if (widgetSubarea.children.length > 0)
    cell.element.find('div.widget-area').show();
  cell.element.find('div.cellPlaceholder')[0].innerHTML = '';
  collapseSpan = cell.element.find('span.glyph-collapse-cell').removeClass(UNCOLLAPSE_BUTTON_CLASS);
  collapseSpan = cell.element.find('span.glyph-collapse-cell').addClass(COLLAPSE_BUTTON_CLASS);
  collapseSpan = cell.element.find('span.title-collapse-cell')[0].innerText = 'Collapse';

  cell.metadata[CELL_METADATA_COLLAPSED] = false;

  // uncollapse code section as well
  uncollapseCode(cell);
}

/**
 * Toggle collapsing the code part of the cell
 */
function toggleCollapseCode(cell) {
  isCollapsed = cell.metadata[CELL_METADATA_CODE_COLLAPSED] || false;
  if (isCollapsed) {
    uncollapseCode(cell);
  } else {
    collapseCode(cell);
  }
}

/**
 * Collapse the code part of the cell
 */
function collapseCode(cell) {
  if (cell.cell_type !== 'code') {
    // can't collapse code in non-code cells
    return;
  }

  cell.element.addClass('codehidden');
  cell.element.find('span.title-collapse-code')[0].innerText = 'Show Code';
  cell.metadata[CELL_METADATA_CODE_COLLAPSED] = true;
}

/**
 * Uncollapse the code part of the cell
 */
function uncollapseCode(cell) {
  cell.element.removeClass('codehidden');
  cell.element.find('span.title-collapse-code')[0].innerText = 'Hide Code';
  cell.metadata[CELL_METADATA_CODE_COLLAPSED] = false;
}

/**
 * Create an HTML button for the cell minitoolbar and return it
 */
function createCellMiniToolbarButton(description) {
  let buttonLi = document.createElement('li');

  let anchor = document.createElement('a');
  anchor.href = "#";

  // span for button icon
  let glyphSpan = document.createElement('span');
  glyphSpan.className = description.className + ' glyph-' + description.id;
  glyphSpan.style.width = '20px';
  anchor.appendChild(glyphSpan);

  // span for button title
  let titleSpan = document.createElement('span');
  titleSpan.innerText = description.title;
  titleSpan.className = 'title-' + description.id;

  anchor.appendChild(titleSpan);
  buttonLi.appendChild(anchor);
  buttonLi.addEventListener('click', description.clickHandler);
  return buttonLi;
}

/**
 * Patch the cell's element to add custom UI buttons
 */
function addCellMiniToolbar(cell) {

  let toolbarDiv = document.createElement('div');
  toolbarDiv.className = 'dropdown minitoolbar';

  let toolbarToggle = document.createElement('button');
  toolbarToggle.className = 'btn btn-default dropdown-toggle minitoolbar-toggle';
  toolbarToggle.setAttribute('data-toggle', 'dropdown');
  toolbarToggle.innerHTML = '<span class="fa fa-bars"></span>';
  toolbarDiv.appendChild(toolbarToggle);

  let toolbarButtonList = document.createElement('ul');
  toolbarButtonList.className = 'dropdown-menu';
  toolbarToggle.addEventListener('click', function(e) {
    var parentElement = $(this.parentElement);
    if (parentElement.hasClass('open')) {
      parentElement.removeClass('open');
      e.stopPropagation();
    } else {
      parentElement.addClass('open');
      var offset = parentElement.offset().top;
      var btn = parentElement.find('button')[0];
      var dropDown = parentElement.find('ul')[0];
      var minHeight = offset + btn.clientHeight + dropDown.clientHeight;
      parentElement.removeClass('open');

      // Drop the menu down if the window is tall enough for the offset of the menu
      // + height of menu + 10 pixel buffer space. Otherwise drop up
      if ($(window).height() > minHeight + 10) {
        parentElement.addClass('dropdown');
        parentElement.removeClass('dropup');
      } else {
        parentElement.addClass('dropup');
        parentElement.removeClass('dropdown');
      }
    }
  });
  toolbarDiv.appendChild(toolbarButtonList);


  minitoolbarButtons = [
    // run cell
    {
      id: 'run-cell',
      title: 'Run',
      className: 'fa ' + RUN_CELL_BUTTON_CLASS,
      clickHandler: function() {
        cell.execute();
      }
    },
    // clear cell
    {
      id: 'clear-cell',
      title: 'Clear',
      className: 'fa ' + CLEAR_CELL_BUTTON_CLASS,
      clickHandler: function() {
        cell.clear_output();
      }
    },
    // collapse cell
    {
      id: 'collapse-cell',
      title: 'Collapse',
      className: 'fa ' + COLLAPSE_BUTTON_CLASS,
      clickHandler: function() {
        toggleCollapseCell(cell);
      }
    },
    // collapse code
    {
      id: 'collapse-code',
      title: 'Hide Code',
      className: 'fa ' + COLLAPSE_CODE_BUTTON_CLASS,
      clickHandler: function() {
        toggleCollapseCode(cell);
      }
    }
  ];

  // cell collapse placeholder
  let placeholderDiv = document.createElement('div');
  placeholderDiv.className = 'cellPlaceholder btn btn-default';
  placeholderDiv.title = 'Uncollapse cell';
  placeholderDiv.addEventListener('click', function() {
    uncollapseCell(cell);
  });
  cell.element.append(placeholderDiv);

  minitoolbarButtons.forEach(button => {
    buttonHtml = createCellMiniToolbarButton(button);
    toolbarButtonList.appendChild(buttonHtml);
  });

  // add the minitoolbar to the cell
  cell.element.prepend(toolbarDiv);

  // collapse cells according to their saved metadata if any
  if (CELL_METADATA_COLLAPSED in cell.metadata && cell.metadata[CELL_METADATA_COLLAPSED] === true) {
    collapseCell(cell);
  }

  // collapse cell code according to their saved metadata if any
  if (CELL_METADATA_CODE_COLLAPSED in cell.metadata && cell.metadata[CELL_METADATA_CODE_COLLAPSED] === true) {
    collapseCode(cell);
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
      var path = window.location.pathname;
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
        var path = window.location.pathname;
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
    notebook.save_checkpoint();
  })

  $('#saveCopyButton').click(function() {
    notebook.copy_notebook();
  })

  $('#renameButton').click(function() {
    notebook.save_widget.rename_notebook({ notebook: notebook });
  })

  $('#restoreButton').click(function() {
    notebook.restore_checkpoint();
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
    reportEvent(event);

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
    reportEvent(event);

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
    notebook.restart_kernel()
      .then(success => removeCompletedMarks());
    this.blur();
  });

  $('#toggleSidebarButton').click(function() {
    document.getElementById('sidebarArea').classList.toggle('larger');
    document.getElementById('toggleSidebarButton').classList.toggle('fa-flip-horizontal');
    this.blur();
  });

  $('#hideSidebarButton').click(function() {
    toggleSidebar();
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

    document.getElementById('navigationButton').classList.add('active');
    document.getElementById('helpButton').classList.remove('active');
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

    // create the cell toolbar
    Jupyter.notebook.get_cells().forEach(function(cell) {
      if (cell.cell_type === 'code')
        addCellMiniToolbar(cell)
    });

    // patch any cell created from now on
    events.on('create.Cell', function(e, params) {
      addCellMiniToolbar(params.cell);
    });

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


function initializeEditApplication(ipy, editor) {
  function navigateAlternate(alt) {
    var url = document.location.href.replace('/edit', alt);
    if (url.includes("?")) {
      url = url.slice(0, url.lastIndexOf("?"));
    }
    url = url + '?download=true';

    if (!editor.clean) {
      editor.save().then(function() {
        window.open(url);
      });
    }
    else {
      window.open(url);
    }
  }

  $('#saveButton').click(function() {
    editor.save();
  })

  $('#renameButton').click(function() {
    notebook.save_widget.rename();
  })

  $('#downloadButton').click(function() {
    navigateAlternate('/files');
  })
}


function initializeNotebookList(ipy, notebookList, newNotebook, events, dialog, utils) {
  function addNotebook(e) {
    newNotebook.new_notebook();
    e.target.blur();

    var event = {
      'event': 'concordEvent',
      'pagePath': '/virtual/datalab/createNotebook',
      'eventType': 'datalab',
      'eventName': 'createNotebook',
    }
    reportEvent(event);
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

  function openEditor(e) {
    prefix = location.protocol + '//' + location.host + "/edit/";
    Jupyter.notebook_list.selected.forEach(notebook => {
      window.open(prefix + notebook.path, '_blank');
    });
  }

  // Extend the selection changed method to show/hide the editor button
  notebookSelectedFn = notebookList._selection_changed;
  notebookList._selection_changed = function() {
    notebookSelectedFn.apply(this, arguments);
    if (notebookList.selected.length === 1 && notebookList.selected[0].type !== 'directory')
      $('#editorButton').show();
    else
      $('#editorButton').hide();
  }

  document.getElementById('addNotebookButton').addEventListener('click', addNotebook, false);
  document.getElementById('addFolderButton').addEventListener('click', addFolder, false);
  document.getElementById('editorButton').addEventListener('click', openEditor, false);

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
    var optional = (version >= versionInfo.last);
    var messageDiv = document.getElementById('updateMessageArea');
    var message = 'You are using DataLab 0.5.' + version + '. ' +
        (optional ? 'An optional' : 'A recommended') + ' update (0.5.' + versionInfo.latest +
        ') is available (see <a href="https://github.com/googledatalab/datalab/wiki/Release-Info"' +
        '>what\'s new</a>).'
    messageDiv.innerHTML = message;
    messageDiv.classList.add('alert');
    messageDiv.classList.add(optional ? 'alert-warning' : 'alert-danger');
    messageDiv.style.display = 'block';
  }

  checkVersion(window.datalab.versions);
}


function initializeDataLab(ipy, events, dialog, utils, security) {
  var saveFn = function() {
    if (('notebook' in ipy) && ipy.notebook) {
      ipy.notebook.save_checkpoint();
    }
  }
  initializePage(dialog, saveFn);

  // Override the sanitizer - all notebooks within the user's volume are implicity
  // trusted, and there is no need to remove scripts from cell outputs of notebooks
  // with previously saved results.
  security.sanitize_html = function(html) {
    return html;
  }

  var pageClass = document.body.className;
  if (pageClass.indexOf('notebook_app') >= 0) {
    initializeNotebookApplication(ipy, ipy.notebook, events, dialog, utils);
  }
  else if (pageClass.indexOf('edit_app') >= 0) {
    initializeEditApplication(ipy, ipy.editor);
  }
  else if (pageClass.indexOf('notebook_list') >= 0) {
    initializeNotebookList(ipy, ipy.notebook_list, ipy.new_notebook_widget, events, dialog, utils);
  }
}

require(['base/js/namespace', 'base/js/events', 'base/js/dialog', 'base/js/utils', 'base/js/security'],
        initializeDataLab);
