define(['util'], (util) => {

  // Compare two arrays, each representing a semantic version in the form of [0,1,2]
  // Returns -1, 0, 1. Returns null if they're malformed
  function semverCompare(v1, v2) {
    for (var i = 0; i < 3; i++) {
      var token1 = Number(v1[i]);
      var token2 = Number(v2[i]);
      if (token1 > token2)
        return 1;
      if (token2 > token1)
        return -1;
      if (isNaN(token1) || isNaN(token2))
        return null;
    }
    return 0;
  }

  // Turn a string version (e.g. "1.1.20170411" or just "20170411") into a backward
  // compatible version array (e.g ["1","1","20170411"]).
  // If the version doesn't have MAJOR and MINOR components (old behavior), then
  // treat it as only the PATCH part of a semver. Hard code prefix to 0.5 to match
  // the old version strings, so that clients do not get inconsistent numbers
  function strToSemver(versionStr) {
    let semver = versionStr.toString().split('.').map(x => +x);
    if (semver.length !== 1 && semver.length !== 3) {
      util.debug.log('Malformed current version string. Found:', versionStr);
      return null;
    }
    // If only one component was found, it's the PATCH part
    if (semver.length === 1) {
      semver = [0, 5].concat(Number(semver[0]));
    }
    return semver;
  }

  function checkVersion(latestVersion) {
    // Current version is sent as part of the HTML template document from the notebook server
    var currentVersion = document.body.getAttribute('data-version-id');
    if (currentVersion === undefined || latestVersion === undefined) {
      util.debug.log('Failed to get current or latest version string.');
      return;
    }
    currentSemver = strToSemver(currentVersion);
    latestSemver = strToSemver(latestVersion.latest);
    lastSemver = strToSemver(latestVersion.last);

    // Compare, if current version is greater than or equal to latest, we're done
    if (semverCompare(currentSemver, latestSemver) > -1) {
      return;
    }

    // Old client. Display message to recommend update
    var optional = semverCompare(currentSemver, lastSemver) > -1;
    var messageDiv = document.getElementById('updateMessageArea');
    var message = 'You are using DataLab ' + currentSemver.join('.') + '. ' +
        (optional ? 'An optional' : 'A recommended') + ' update (' + latestSemver.join('.') +
        ') is available (see <a href="https://github.com/googledatalab/datalab/releases"' +
        '>what\'s new</a>).'
    messageDiv.innerHTML = message;
    messageDiv.classList.add('alert');
    messageDiv.classList.add(optional ? 'alert-warning' : 'alert-danger');
    messageDiv.style.display = 'block';
  }

  function postLoad(notebookList, newNotebook, dialog) {
    function addNotebook(e) {
      newNotebook.new_notebook();
      e.target.blur();

      var event = {
        'event': 'concordEvent',
        'pagePath': '/virtual/datalab/createNotebook',
        'eventType': 'datalab',
        'eventName': 'createNotebook',
      }
      util.reportEvent(event);
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
              },
              keyboard_manager: IPython.keyboard_manager,
          });
        });
      e.target.blur();
    }

    function addTerminal(e) {
      let newWindow = window.open(undefined, IPython._target);
      let addTerminalUrl = util.datalabLink('/api/terminals');
      let settings = {
        type : 'POST',
        dataType: 'json',
        success: (data, status, jqXHR) => {
          newWindow.location = util.datalabLink('/terminals/' + encodeURIComponent(data.name));
        },
        error : function(jqXHR, status, error){
          newWindow.close();
          util.debug.log(jqXHR, status, error);
        },
      };
      util.debug.log('Sending terminal request to ' + addTerminalUrl);
      $.ajax(addTerminalUrl, settings);
    }

    function openEditor(e) {
      Jupyter.notebook_list.selected.forEach(notebook => {
        window.open(util.datalabLink('/edit/' + notebook.path), '_blank');
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
    document.getElementById('addTerminalButton').addEventListener('click', addTerminal, false);
    document.getElementById('editorButton').addEventListener('click', openEditor, false);

    (function buildBreadcrumbContent() {
      var path = util.datalabSubPath(location.pathname);
      util.debug.log('Building breadcrumbs off of ' + path);

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
      var basePath = util.datalabLink('/tree')
      html.push('<ul class="breadcrumb">');
      html.push('<li><a href="' + basePath + '"><i class="material-icons">home</i></a></li>');

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
          element = '<li><a href="' + basePath + '/' + segments.join('/') + '">' + pathPart + '</a></li>';
        }

        html.push(element);
      }

      html.push('</ul>');

      document.getElementById('project_name').innerHTML = html.join('');

    })();

    fileSearchPath = util.datalabLink('/_filesearch?');

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
              window.open(util.datalabLink("/notebooks/" + path));
            } else {
              window.open(util.datlabLink("/edit/" + path));
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

    checkVersion(window.datalab.versions);
  }

  return {
    postLoad: postLoad,
    _semverCompare: semverCompare,
    _strToSemver: strToSemver,
    _checkVersion: checkVersion
  };
});
