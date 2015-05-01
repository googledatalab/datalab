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
 * Directive for creating a modal popup
 *
 * The transcluded html will appear within the main content region.
 */
import logging = require('app/common/Logging');
import constants = require('app/common/Constants');
import app = require('app/App');


var log = logging.getLogger(constants.scopes.layouts);

interface ModalLayoutScope extends ng.IScope {
  // Directive attributes:
  mid: string;  // the id of the modal; used for dismissing.
  okText: string;  // text to show on the OK button.
  canceltext: string;  // text to show on the cancel button.
  title: string;  // the modal title.
  action: string;  // the action to perform on OK button click.
  
  ctrl: ModalLayoutController;
}

class ModalLayoutController {
  _scope: ModalLayoutScope;
  _document: ng.IDocumentService;

  static $inject = ['$scope', '$document'];

  constructor (scope: ModalLayoutScope, document: ng.IDocumentService) {
    this._scope = scope;
    this._scope.ctrl = this;
    this._document = document;
  }
  
  dismiss() {
    document.getElementById(this._scope.mid).style.display = 'none';
  }
}

/**
 * Creates the modal directive definition.
 *
 * @return directive definition
 */
function modalLayoutDirective (): ng.IDirective {
  return {
    restrict: 'E',
    transclude: true,
    templateUrl: constants.scriptPaths.app + '/components/layouts/modal/modallayout.html',
    controller: ModalLayoutController,
    scope: {
      mid: '@',
      okText: '@',
      cancelText: '@',
      title: '@',
      action: '&',
    }
  }
}

app.registrar.directive(constants.layouts.modal.directiveName, modalLayoutDirective);
log.debug('Registered modal layout directive');
