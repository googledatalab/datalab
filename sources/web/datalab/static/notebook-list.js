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
    html.push('<li><a href="/tree"><i class="material-icons">home</i></a></li>');

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

  fileSearchPath = location.protocol + '//' + location.host + '/_filesearch?';

  searchDiv = $('#tree-filter');
  $.getJSON(fileSearchPath, (result) => {
    if (result.tooManyFiles === true || !result.indexingEnabled) {
      searchDiv.prop('placeholder', 'File finder disabled');
      searchDiv.prop('disabled', true);
    } else {
      searchDiv.autocomplete({
        appendTo: '.tree-filter-complete',
        position: { of: '.tree-filter-complete' },
        source: (request, response) => {

          pattern = encodeURIComponent(searchDiv.val());
          patternSearchPath = fileSearchPath + 'pattern=' + pattern;

          if (patternSearchPath !== '') {
            $.getJSON(patternSearchPath, (result) => {
              response(result.files);
              if (result.fullResultSize > 20) {
                $('.ui-autocomplete').append('<div class="autocomplete-message">Showing 20 out of ' +
                  result.fullResultSize + ' results</div>');
              }
              if (result.tooManyFiles === true) {
                $('.ui-autocomplete').prepend(
                  '<div class="autocomplete-message">Too many files found. Showing partial results</div>');
              } else if (result.indexReady === false) {
                $('.ui-autocomplete').prepend(
                  '<div class="autocomplete-message">Indexing files.. Showing partial results</div>');
              }
            });
          }
        },
        select: (e, selected) => {
          var path = selected.item.value;
          if (path.endsWith('.ipynb')) {
            window.open(location.protocol + "//" + location.host + "/notebooks/" + path);
          } else {
            window.open(location.protocol + "//" + location.host + "/edit/" + path);
          }
        },
        delay: 500,
        messages: {
          noResults: '',
          results: function() {}
        }
      });
    }
  });

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
