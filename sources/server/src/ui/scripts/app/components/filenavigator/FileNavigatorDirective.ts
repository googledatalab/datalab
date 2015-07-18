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

/**
 * Directive for a file navigator.
 */

/// <amd-dependency path="app/components/layouts/modal/ModalLayoutDirective" />
/// <reference path="../../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <reference path="../../shared/requests.d.ts" />
/// <amd-dependency path="app/components/basename/BaseNameFilter" />
/// <amd-dependency path="app/services/ContentService" />
import constants = require('app/common/Constants');
import logging = require('app/common/Logging');
import _app = require('app/App');

var log = logging.getLogger(constants.scopes.fileNavigator);

interface SortProperties {
  column: string;
  descending: boolean;
}

interface FileNavigatorScope extends ng.IScope {
  path: string;
  breadcrumbs: string[];
  resources: app.Resource[];
  ctrl: FileNavigatorController;
  sortColumn: string;
  sortOrder: string;
  dropDownVisible: boolean;
  properties: any;
}

class FileNavigatorController {

  static $inject = ['$scope', '$location', '$window', '$document', '$q',
      constants.contentService.name];

  _scope: FileNavigatorScope;
  _location: ng.ILocationService;
  _window: ng.IWindowService;
  _document: ng.IDocumentService;
  _service: app.IContentService;
  _q: ng.IQService;

  /**
   * Constructor.
   *
   * @param scope The directive's scope.
   */
  constructor (
      scope: FileNavigatorScope,
      location: ng.ILocationService,
      window: ng.IWindowService,
      document: ng.IDocumentService,
      q: ng.IQService,
      service: app.IContentService) {

    this._scope = scope;
    this._location = location;
    this._window = window;
    this._document = document;
    this._service = service;
    this._q = q;

    this._scope.ctrl = this;
    this._scope.sortColumn = 'relativePath';
    this._scope.sortOrder = '+';
    this._scope.path = '/';
    this._scope.breadcrumbs = ['/'];
    this._scope.dropDownVisible = false;
    this._scope.properties = {};

    this.updateView(); // Get initial page.
  }

  /**
   * Refresh the view by getting the latest resource list from the content service.
   */
  updateView(path: string = undefined): ng.IPromise<app.requests.ListContentResponse> {
    if (path == undefined) {
      path = this._scope.path;
    }
    log.debug('List ' + path);

    return this._service.list(path)
        .then((response: app.requests.ListContentResponse) => {
          // Update the UI with the set of resources from the response.
          this.update(response);
          // Return the response value intact for further processing.
          return response;
        });
  }

  /**
   * Navigate using the breadcrumb path segments, given the index of the segment the user
   * clicked on.
   *
   * @param index: the breadcrumb segment index.
   */
  updatePath(index: number) {
    var path = '/';
    if (index > 0) {
      path += this._scope.breadcrumbs.slice(1, index + 1).join('/');
    }
    this.updateView(path);
  }

  /**
   * Handle an updated resource list from the content server.
   *
   * @param response: the response from the content server.
   */
  update(response: app.requests.ListContentResponse) {
    this._scope.path = response.prefix;
    this._scope.breadcrumbs = response.prefix == '/' ? ['/'] : response.prefix.split('/');
    this._scope.resources =  response.resources;
  }

  /**
   * Handle a click on a resource name. If it is a directory, switch to it; if it is a
   * notebook, open it in a new browser tab.
   *
   * @param event: the click event.
   * @param resource: the resource that was clicked on.
   */
  handleClick(event: any, resource: app.Resource) {
    if (event) {
      event.preventDefault();
    }
    if (resource.isDirectory) {
      this.updateView(resource.path);
    } else {
      this._openNotebookInTab(resource.path);
    }
  }

  /**
   * Get the CSS class for a column based on sort-order.
   *
   * @param column: the property name associated with the column.
   */
  sortIconClass(column: string) : string {
    if (column == this._scope.sortColumn) {
      return 'sort-' + (this._scope.sortOrder == '-' ? 'down' : 'up');
    }
    return '';
  }

  /**
   * Handle the change in sort order resulting from a column header click.
   *
   * @param column: the property name associated with the column.
   */
  reSort(column: string) {
    if (this._scope.sortColumn == column) {
      // Same column so toggle order.
      this._scope.sortOrder = this._scope.sortOrder == '+' ? '-' : '+';
    } else {
      // New column so switch to that with ascending order.
      this._scope.sortColumn = column;
      this._scope.sortOrder = '+';
    }
  }

 /**
  * Remove a resource with a specified path from the resource list.
  *
  * @param path: the full path of the resource to remove.
  */
  remove(path: string) {
    var resources = this._scope.resources;
    for (var i = 0; i < resources.length; i++) {
      if (resources[i].path == path) {
        resources.splice(i, 1);
        break;
      }
    }
  }

 /**
  * Call the content service to delete an item and then remove it from the resource list.
  *
  * @param resource: the resource to delete.
  */
  deleteResource(resource: app.Resource) {
    this._service.delete(resource.path).then(
      (path: string) => this.remove(path)
    );
  }

 /**
  * Generate a "<n> <units> ago" style message from the lastModified property of a
  * resource.
  *
  * @param lastModified: the date string to convert.
  */
  ageMessage(lastModified: string): string {
    if (lastModified == undefined) {
      return 'Unknown';
    }
    var now = (new Date()).getTime();
    var delta = Math.floor((now - Date.parse(lastModified)) / 1000);
    var unit: string;
    if (delta < 60) {
      unit = 'second';
    } else {
      delta = Math.floor(delta / 60);
      if (delta < 60) {
        unit = 'minute';
      } else {
        delta = Math.floor(delta / 60);
        if (delta < 24) {
          unit = 'hour';
        } else {
          delta = Math.floor(delta / 24);
          if (delta < 7) {
            unit = 'day';
          } else if (delta >= 365.25) {
            delta = Math.floor(delta / 365.25);
            unit = 'year';
          } else {
            delta = Math.floor(delta / 7);
            unit = 'week';
          }
        }
      }
    }
    return '' + delta + ' ' + unit + (delta > 1 ? 's' : '') + ' ago';
  }

 /**
  * Show a modal popup (new file or new folder). This is a bit tricky and we resort to
  * using the global document object to get a reference to the DOM element we need to display.
  *
  * @param event: the click event.
  * @param id: the DOM ID of the modal container.
  */
  showModal(event: any, id: string) {
    if (event) {
      // We don't want the event to be handled by the resource list underneath.
      event.preventDefault();
    }
    this._scope.properties = {
      newFoldername: '',
      newNotebookName: ''
    };

    // Make the modal element visible.
    var modalContainer = document.getElementById(id);
    if (!modalContainer) {
      // Then the page structure may have changed and this code needs updating.
      throw new Error('Modal container element does not exist with expected id "' + id + '"');
    }
    modalContainer.style.display = 'block';

    // Focus the input field automatically.
    var textBox = modalContainer.getElementsByTagName('input')[0]
    if (!textBox) {
      // Then the modal structure may have changed and this needs updating.
      throw new Error('Input text box element was not found where expected.');
    }
    textBox.focus();
  }

  _updateViewAndVerifyPath(path: string, retries: number): ng.IPromise<void> {
    return this.updateView()
        .then((response: app.requests.ListContentResponse) => {
          // Further process the content listing response to verify that the new notebook file
          // was included.
          for (var i = 0; i < response.resources.length; ++i) {
            if (path == response.resources[i].path) {
              // Notebook file was found. Return promise (implicitly) for completion chaining.
              return;
            }
          }

          // Notebook file wasn't found. Retry if still have remaining retries allowed.
          if (retries > 0) {
            log.debug('Retrying list operation because created notebook is not yet available');
            return this._updateViewAndVerifyPath(path, retries - 1);
          } else {
            return this._q.reject();
          }
        });
  }

  /**
   * Creates a new notebook and subsequently opens a new tab to the newly created notebook.
   *
   * The folder name comes from the property bag shared with the modal.
   */
  createNotebook() {
    var path = this._scope.path + this._scope.properties.newNotebookName;
    log.debug('Create notebook ' + path);

    // The new notebook window must be opened within the context/call stack of a user-initiated
    // event (e.g., click) to avoid triggering browser popup blockers.
    //
    // Approach here is to immediately open the window upon the user creating the notebook,
    // and then reload the window once the notebook is created/available.
    var notebookWindow = this._openNotebookInTab('');
    var create = this._service.create(path, undefined)

    create
      .then((response: app.requests.CreateContentResponse) => {
        // Now that the file has been created successfully, update the new window with its path.
        notebookWindow.location.href = '/#/notebooks' + response.createdPath;
      });

    create
      .then((response: app.requests.CreateContentResponse) => {
        // Now that the notebook has been successfully created, need to refresh the view until
        // the new file is available. This is currently required due to the fact that GCS list
        // operations are only eventually consistent. That is, after a GCS request that creates
        // or deletes an object, subsequent list operations on the bucket are not guaranteed to
        // include the added/removed object.
        //
        // Note that GCS is globally consistent for individual object operations (i.e.,
        // read-after-write consistency), so the notebook will be immediately available for
        // reading, just not for listing.
        //
        // The following call will refresh the file navigator view with the latest content
        // listing from storage, and retry a given number of times until the created file is
        // found within the storage listing.
        return this._updateViewAndVerifyPath(response.createdPath, /* number of retries */ 3);
      })
      .catch(() => {
        // After some number of attempts to check for the file in storage, it is still unavailable,
        // but was (supposedly) created successfully. Due to GCS being eventually consistent with
        // no defined upper bound on the time to reach consistency, this situation may occur
        // even though the notebook was created successfully.
        //
        // Likely need to increase the retry count and possibly backoff if this occurs frequently.
        throw new Error(
          'Notebook was created but is unavailable in subsequent content list operation(s)');
      });
  }

  /**
   * Create a folder. The folder name comes from the property bag shared with the
   * modal.
   */
  createFolder() {
    var path = this._scope.path + '/' + this._scope.properties.newFolderName;
    log.debug('Create folder ' + path);
    var data = "{isDirectory: true}";
    this._service.create(path, data).then(
      (response: app.requests.CreateContentResponse) => this.updateView()
    );
  }

  /**
   * Opens the given notebook resource path in a new browser tab.
   *
   * @param resourcePath The path of the notebook resource to open.
   */
  _openNotebookInTab(resourcePath: string) {
    return this._window.open('/#/notebooks' + resourcePath);
  }
}


/**
 * Creates a file navigator directive definition.
 *
 * @return A directive definition.
 */
function fileNavigatorDirective (): ng.IDirective {
  return {
    restrict: 'E',
    replace: true,
    templateUrl: constants.scriptPaths.app + '/components/filenavigator/filenavigator.html',
    controller: FileNavigatorController,
    scope: {
      properties: '@' // A property bag used for the modals.
    }
  }
}

_app.registrar.directive(constants.fileNavigator.directiveName, fileNavigatorDirective);
log.debug('Registered file navigator directive');
