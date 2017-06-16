/*
 * Copyright 2017 Google Inc. All rights reserved.
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

/// <reference path="../../modules/ApiManager.ts" />
/// <reference path="../../modules/Utils.ts" />
/// <reference path="../item-list/item-list.ts" />
/// <reference path="../input-dialog/input-dialog.ts" />

/**
 * File listing element for Datalab.
 * Contains an item-list element to display files, a toolbar to interact with these files,
 * a progress bar that appears while loading the file list, and a navigation bar with
 * breadcrumbs.
 * Navigation is done locally to this element, and it does not modify the client's location.
 * This allows for navigation to be persistent if the view is changed away from the files
 * element.
 */
class FilesElement extends Polymer.Element {

  /**
   * The base path to start navigation from
   */
  public basePath: string;

  /**
   * The current navigation path
   */
  public currentPath: string;

  private _pathHistory: Array<string>;
  private _pathHistoryIndex: number;
  private _fetching: boolean;
  private _fileList: Array<ApiFile>;
  private _fileListRefreshInterval: number;
  private _currentCrumbs: Array<string>;

  static get is() { return "datalab-files"; }

  static get properties() {
    return {
      basePath: {
        type: String,
        value: '/',
      },
      currentPath: {
        type: String,
        value: '',
        observer: '_currentPathChanged',
      },
      _currentCrumbs: {
        type: Array,
        value: function(): Array<string> {
          return [];
        },
      },
      _fileList: {
        type: Array,
        value: function(): Array<ApiFile> {
          return [];
        },
      },
      _pathHistory: {
        type: Array,
        value: function(): Array<string> {
          return [];
        },
      },
      _pathHistoryIndex: {
        type: Number,
        value: -1,
        observer: '_pathHistoryIndexChanged',
      },
      _fetching: {
        type: Boolean,
        value: false,
      },
      _fileListRefreshInterval: {
        type: Number,
        value: 10000,
      }
    }
  }

  /**
   * Called when when the element's local DOM is ready and initialized We use it
   * to initialize element state.
   */
  ready() {
    super.ready();

    // TODO: [yebrahim] The current path should be fetched from the server
    // on initialization, in order to get the last saved user path

    const filesElement = this.shadowRoot.querySelector('#files')
    if (filesElement) {
      filesElement.addEventListener('itemDoubleClick',
                                    this._handleDoubleClicked.bind(this));
    }

    this.$.files.columns = ['Name', 'Status'];
    this.$.files.rows = [{
      name: 'hello world',
      type: 'notebook',
    }, {
      name: 'hello world2',
      type: 'notebook',
    }];

    // Refresh the file list periodically.
    // TODO: [yebrahim] Start periodic refresh when the window is in focus, and
    // the files page is open, and stop it on blur to minimize unnecessary traffic
    setInterval(this._fetchFileList.bind(this), this._fileListRefreshInterval);
  }

  _getNotebookUrlPrefix() {
    let prefix = location.protocol + '//' + location.host + '/';
    return prefix + 'notebooks';
  }

  _getEditorUrlPrefix() {
    let prefix = location.protocol + '//' + location.host + '/';
    return prefix + 'edit';
  }

  /**
   * Calls the ApiManager to get the list of files at the current path, and
   * updates the fileList property.
   */
  _fetchFileList() {
    const self = this;
    self._fetching = true;

    return ApiManager.listFilesAsync(this.basePath + this.currentPath)
      .then(newList => {
        // Only refresh the list if there are any changes. This helps keep
        // the item list's selections intact most of the time
        // TODO: [yebrahim] Try to diff the two lists and only inject the
        // differences in the DOM instead of refreshing the entire list if
        // one item changes. This is tricky because we don't have unique
        // ids for the items. Using paths might work for files, but is not
        // a clean solution.
        if (JSON.stringify(this._fileList) !== JSON.stringify(newList)) {
          this._fileList = newList;
          this._drawFileList();
        }
      }, () => {
        // TODO: [yebrahim] Add dummy data here when debugging is enabled to allow for
        // fast UI iteration using `polymer serve`.
        console.log('Error getting list of files.');
      })
      .then(() => {
        this._fetching = false;
      });
  }

  /**
   * Updates the breadcrumbs array and calls _fetchFileList.
   */
  _currentPathChanged(_: string, oldValue: string) {
    // On initialization, push the current path to path history
    if (oldValue === undefined) {
      this._pushNewPath();
    }

    this._currentCrumbs = this.currentPath.split('/');

    return this._fetchFileList();
  }

  /**
   * Creates a new ItemListRow object for each entry in the file list, and sends
   * the created list to the item-list to render.
   */
  _drawFileList() {
    this.$.files.rows = this._fileList.map(file => {
      return {
        firstCol: file.name,
        secondCol: file.status,
        icon: file.type === 'directory' ? 'folder' : 'editor:insert-drive-file',
        selected: false
      };
    });
  }

  /**
   * Called when a double click event is dispatched by the item list element.
   * If the clicked item is a directory, pushes it onto the nav stack, otherwise
   * opens it in a new notebook or editor session.
   */
  _handleDoubleClicked(e: ItemClickEvent) {
    let clickedItem = this._fileList[e.detail.index];
    if (clickedItem.type === 'directory') {
      this.currentPath = clickedItem.path;
      this._pushNewPath();
    } else if (clickedItem.type === 'notebook') {
      window.open(this._getNotebookUrlPrefix() + '/' + clickedItem.path, '_blank');
    } else {
      window.open(this._getEditorUrlPrefix() + '/' + clickedItem.path, '_blank');
    }
  }

  /**
   * Navigates to the path of the clicked breadcrumb.
   */
  _crumbClicked(e: MouseEvent) {
    const target = <HTMLDivElement>e.target;
    // Treat the home crumb differently since it's not part of the dom-repeat
    if (target.id === 'home-crumb') {
      this.currentPath = '';
    } else {
      const clickedCrumb = this.$.breadcrumbsTemplate.indexForElement(e.target);
      this.currentPath = this._currentCrumbs.slice(0, clickedCrumb + 1).join('/');
    }
    this._pushNewPath();
  }

  /**
   * Pushes a new navigation path on the stack and updates the index.
   */
  _pushNewPath() {
    // First, remove all items in the array past _pathHistoryIndex. These are only
    // there to allow for forward navigation after going back, but they have no
    // effect when a new path is explicitly added by opening a directory or clicking
    // on a breadcrumb.
    this._pathHistory.splice(this._pathHistoryIndex + 1);
    // Only push the new path if it's not equal to the top-most path on the stack
    if (!this._pathHistory.length ||
        this._pathHistory[this._pathHistory.length - 1] !== this.currentPath) {
      this._pathHistory.push(this.currentPath);
      this._pathHistoryIndex = this._pathHistory.length - 1;
    }
  }

  /**
   * Goes back one step in history.
   */
  _navBackward() {
    this._pathHistoryIndex -= 1;
    this.currentPath = this._pathHistory[this._pathHistoryIndex];
  }

  /**
   * Goes forward one step in history.
   */
  _navForward() {
    this._pathHistoryIndex += 1;
    this.currentPath = this._pathHistory[this._pathHistoryIndex];
  }

  /**
   * Maintains the enabled/disabled state of the navigation buttons according to
   * the current history index value.
   */
  _pathHistoryIndexChanged() {
    this.$.backNav.disabled = this._pathHistoryIndex === 0;
    this.$.forwardNav.disabled = this._pathHistoryIndex === this._pathHistory.length - 1;
  }

  /**
   * Calls the ApiManager to create a new notebook, then fetches the updated
   * list of files to redraw the list
   */
  _createNotebook() {

    // First, open a dialog to let the user specify a name for the notebook.
    const inputOptions: DialogOptions = {
      title: 'New Notebook', 
      withInput: true,
      inputLabel: 'Notebook Name',
      okTitle: 'Create',
    };

    Utils.getUserInputAsync(inputOptions)
      .then((closeResult: DialogCloseResult) => {
        // Only if the dialog has been confirmed with some user input, rename the
        // newly created file. Then if that is successful, reload the file list
        if (!closeResult.canceled && closeResult.userInput) {
          ApiManager.createNewNotebook()
            .then((notebook: JupyterFile) =>
                  ApiManager.renameItem(notebook.name, closeResult.userInput + '.ipynb'))
            .then(this._fetchFileList.bind(this));
        }
      });
  }

  _renameSelectedItem() {

    const selectedIndices = this.$.files.getSelectedIndices();
    if (selectedIndices.length === 1) {
      const i = selectedIndices[0];
      const selectedObject = this._fileList[i];

      // First, open a dialog to let the user specify a name for the selected item.
      const inputOptions: DialogOptions = {
        title: 'Rename ' + selectedObject.type.toString(), 
        withInput: true,
        inputLabel: 'New name',
        inputValue: selectedObject.name,
        okTitle: 'Rename',
      };

      Utils.getUserInputAsync(inputOptions)
        .then((closeResult: DialogCloseResult) => {
          // Only if the dialog has been confirmed with some user input, rename the
          // selected item. Then if that is successful, reload the file list
          if (!closeResult.canceled && closeResult.userInput) {
            ApiManager.renameItem(selectedObject.name, closeResult.userInput);
          }
        });
    }
  }
}

customElements.define(FilesElement.is, FilesElement);

