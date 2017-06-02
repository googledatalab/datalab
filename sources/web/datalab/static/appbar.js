define(['static/idle-timeout'], function(idleTimeout) {
  function toggleSidebar() {
    var d = document.getElementById('sidebarArea');
    d.style.display = (d.style.display == 'none') ? 'block' : 'none';
    rotated = $('#hideSidebarButton>.material-icons').css('transform').indexOf('matrix') > -1;
    $('#hideSidebarButton>.material-icons').css('transform', rotated ? '' : 'rotate(180deg)')
  }

  function showHelp(markup) {
    document.getElementById('navigation').style.display = 'none';
    document.getElementById('help').style.display = '';

    if (markup === undefined)
      markup = $('#datalabHelp').text();
    $('#help').html(markup);

    if (document.getElementById('sidebarArea').style.display == 'none') {
      toggleSidebar();
    }
  }

  // Populate help for the first time sidebar is opened
  markup = $('#datalabHelp').text();
  $('#help').html(markup);

  function restartDatalab() {
    var restartUrl = window.location.protocol + "//" + window.location.host + "/_restart";

    function redirect() {
      window.location = '/';
    }

    xhr(restartUrl, function(){
      // We redirect to signal to the user that the restart did something.
      // However, we have to delay that a bit to give Datalab time to restart.
      window.setTimeout(redirect, 500);
    }, {method: 'POST'});
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
      xhr(path, null, {method: 'POST'});
    }
  }

  function initializeAppBar(dialog, saveFn) {

    function showAbout() {
      var version = document.body.getAttribute('data-version-id');
      var reportingEnabled = (document.body.getAttribute('data-reporting-enabled') == 'true');
      var dialogContent =
        '<p>Interactive notebooks, with Python and SQL on Google Cloud Platform.</p>' +
        '<p>Explore, transform, visualize and process data using BigQuery and Google Cloud Storage.</p><br />' +
        '<pre>Version: ' + version  + '\nBased on Jupyter (formerly IPython) 4</pre>' +
        '<h5><b>More Information</b></h5>' +
        '<i class="material-icons">open_in_new</i><a href="https://cloud.google.com" target="_blank"> Product information</a><br />' +
        '<i class="material-icons">open_in_new</i><a href="https://github.com/googledatalab/datalab" target="_blank"> Project on GitHub</a><br />' +
        '<i class="material-icons">open_in_new</i><a href="/static/about.txt" target="_blank"> License and software information</a><br />' +
        '<i class="material-icons">open_in_new</i><a href="https://cloud.google.com/terms/" target="_blank"> Terms of Service</a><br />' +
        '<i class="material-icons">open_in_new</i><a href="http://www.google.com/intl/en/policies/" target="_blank"> Privacy Policy</a><br />' +
        '<i class="material-icons">open_in_new</i><a href="javascript:require([\'appbar\'],appbar=>appbar.restartDatalab())"> Restart Server</a><br />';

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
      idleTimeout.updateTimeoutInfo($(this).parent());
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

    // If inside a notebook, prepare notebook-specific help link inside the sidebar
    if (document.getElementById('sidebarArea') !== null) {
      $('#showHelpLink').click(function(e) {
        showHelp(document.getElementById('datalabHelp').textContent);
        e.preventDefault();
      });
      $('#showHelpLink').show()
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

      $('#navigationButton').show()
    }
    $('#idleTimeoutEnabledButton').click(idleTimeout.toggleIdleTimeout);
    $('#idleTimeoutDisabledButton').click(idleTimeout.toggleIdleTimeout);
    $('#aboutButton').click(showAbout);
    $('#settingsButton').click(function() {
      $.get('/static/settings.html', (markup) => {
        dialog.modal({
          title: 'Settings',
          body: $(markup),
          buttons: { Close: {} }
        });
      });
    });
    $('#feedbackButton').click(function() {
      window.open('https://groups.google.com/forum/#!newtopic/google-cloud-datalab-feedback');
    });

    // Set up idle-timeout.
    idleTimeout.setupTimeoutTimer();
  }

  return {
    init: initializeAppBar,
    restartDatalab: restartDatalab,
    showHelp: showHelp,
    toggleSidebar: toggleSidebar,
  };
});
