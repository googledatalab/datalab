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

  static $inject = ['$scope', '$location', '$window', '$document',
      constants.contentService.name];

  _scope: FileNavigatorScope;
  _location: ng.ILocationService;
  _window: ng.IWindowService;
  _document: ng.IDocumentService;
  _service: app.IContentService;

  /**
   * Constructor.
   *
   * @param scope The directive's scope.
   */
  constructor (scope: FileNavigatorScope, location: ng.ILocationService,
      window: ng.IWindowService, document: ng.IDocumentService, service: app.IContentService) {
    this._scope = scope;
    this._location = location;
    this._window = window;
    this._document = document;
    this._service = service;

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
  updateView(path: string = undefined) {
    if (path == undefined) {
      path = this._scope.path;
    }
    log.debug('List ' + path);
    this._service.list(path).then(
      (response: app.requests.ListContentResponse) => this.update(response)
    );
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
      this._window.open('/#/notebooks' + resource.path);
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

 /*
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
    document.getElementById(id).style.display = 'block';
  }

  /**
   * Create a new notebook. The folder name comes from the property bag shared with the
   * modal.
   */
  createNotebook() {
    var path = this._scope.path + this._scope.properties.newNotebookName;
    log.debug('Create notebook ' + path);
    this._service.create(path, undefined).then(
      (item: string) => this.updateView()
    );
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
      (item: string) => this.updateView()
    );
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
