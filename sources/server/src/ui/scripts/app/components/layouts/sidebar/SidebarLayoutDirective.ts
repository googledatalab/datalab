/*
 * Copyright 2014 Google Inc. All rights reserved.
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
 * Directive for creating a two-column layout with common side navigation bar
 *
 * The transcluded html will appear within the main content region.
 */
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import app = require('app/App');


var log = logging.getLogger(constants.scopes.layouts);

interface SidebarLayoutScope extends ng.IScope {
  activeTab: string;
}

class SidebarLayoutController {

  _scope: SidebarLayoutScope;

  static $inject = ['$scope', '$location'];

  constructor (scope: SidebarLayoutScope, location: ng.ILocationService) {
    this._scope = scope;
    scope.activeTab = location.path();
  }
}

/**
 * Creates the sidenav directive definition.
 *
 * @return directive definition
 */
function sidebarLayoutDirective (): ng.IDirective {
  return {
    restrict: 'E',
    transclude: true,
    templateUrl: constants.scriptPaths.app + '/components/layouts/sidebar/sidebarlayout.html',
    controller: SidebarLayoutController
  }
}

app.registrar.directive(constants.layouts.sidebar.directiveName, sidebarLayoutDirective);
log.debug('Registered sidebar layout directive');
