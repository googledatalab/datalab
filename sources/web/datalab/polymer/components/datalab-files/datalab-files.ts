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
/// <reference path="../../../../datalab/common.d.ts" />

/**
 * File listing element for Datalab.
 * Contains an item-list element to display files, a toolbar to interact with these files,
 * a progress bar that appears while loading the file list, and a navigation bar with
 * breadcrumbs.
 * Navigation is done locally to this element, and it does not modify the client's location.
 * This allows for navigation to be persistent if the view is changed away from the files
 * element.
 *
 * A mini version of this element can be rendered by specifying the "small" attribute, which
 * removes the toolbar and the refresh button, and uses the item-list element with no header
 * and no selection. It also doesn't do anything when a file is double clicked.
 * This is meant to be used for browsing only, such as the case for picking files or directories.
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

  /**
   * The currently selected file if exactly one is selected, or null if none is.
   */
  public selectedFile: ApiFile | null;

  /*
   * Smaller version of this element to be used as a flyout file picker.
   */
  public small: boolean;

  private _pathHistory: Array<string>;
  private _pathHistoryIndex: number;
  private _fetching: boolean;
  private _fileList: Array<ApiFile>;
  private _fileListRefreshInterval: number;
  private _fileListRefreshIntervalHandle: number;
  private _currentCrumbs: Array<string>;
  private _isDetailsPaneToggledOn: Boolean;
  private _addToolbarCollapseThreshold = 800;
  private _updateToolbarCollapseThreshold = 600;
  private _detailsPaneCollapseThreshold = 600;

  static readonly _deleteListLimit = 10;

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
      selectedFile: {
        type: Object,
        value: null,
      },
      small: {
        type: Boolean,
        value: false,
      },
      _currentCrumbs: {
        type: Array,
        value: () => [],
      },
      _fileList: {
        type: Array,
        value: () => [],
      },
      _pathHistory: {
        type: Array,
        value: () => [],
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
      },
      _isDetailsPaneToggledOn: {
        type: Boolean,
        value: true,
      },
      _isDetailsPaneEnabled: {
        type: Boolean,
        computed: '_getDetailsPaneEnabled(small, _isDetailsPaneToggledOn)',
      },
    }
  }

  /**
   * Called when when the element's local DOM is ready and initialized We use it
   * to initialize element state.
   */
  ready() {
    // Must set this to true before calling super.ready(), because the latter will cause
    // property updates that will cause _fetchFileList to be called first, we don't want
    // that. We want ready() to be the entry point so it gets the user's last saved path.
    this._fetching = true;

    super.ready();

    // Get the last startup path.
    SettingsManager.getUserSettingsAsync(true /*forceRefresh*/)
      .then((settings: common.UserSettings) => {
        if (settings.startuppath) {
          let path = settings.startuppath;
          if (path.startsWith(this.basePath)) {
            path = path.substr(this.basePath.length);
          }
          // For backward compatibility with the current path format.
          if (path.startsWith('/tree/')) {
            path = path.substr('/tree/'.length);
          }
          this.currentPath = path;
        }
      })
      .catch(() => console.log('Failed to get the user settings.'))
      .then(() => {
        this._fetching = false;
        // Refresh the file list periodically.
        // TODO: [yebrahim] Start periodic refresh when the window is in focus, and
        // the files page is open, and stop it on blur to minimize unnecessary traffic
        this._fileListRefreshIntervalHandle =
            setInterval(this._fetchFileList.bind(this), this._fileListRefreshInterval);
        // Now refresh the list for the initialization to complete.
        this._fetchFileList();
      });

    const filesElement = this.shadowRoot.querySelector('#files')
    if (filesElement) {
      filesElement.addEventListener('itemDoubleClick',
                                    this._handleDoubleClicked.bind(this));
      filesElement.addEventListener('itemSelectionChanged',
                                    this._handleSelectionChanged.bind(this));
    }

    // For a small file/directory picker, we don't need to show the status.
    this.$.files.columns = this.small ? ['Name'] : ['Name', 'Status'];
  }

  disconnectedCallback() {
    // Clean up the refresh interval. This is important if multiple datalab-files elements
    // are created and destroyed on the document.
    clearInterval(this._fileListRefreshIntervalHandle);
  }

  async _getNotebookUrlPrefix() {
    // Notebooks that are stored on the VM requires the basepath.
    let basepath = await ApiManager.getBasePath();
    let prefix = location.protocol + '//' + location.host + basepath + '/';
    return prefix + 'notebooks';
  }

  async _getEditorUrlPrefix() {
    // Notebooks that are stored on the VM requires the basepath.
    let basepath = await ApiManager.getBasePath();
    let prefix = location.protocol + '//' + location.host + basepath+ '/';
    return prefix + 'edit';
  }

  /**
   * Calls the ApiManager to get the list of files at the current path, and
   * updates the fileList property.
   */
  _fetchFileList() {
    // Don't overlap fetch requests. This can happen we can do fetch from three sources:
    // - Initialization in the ready() event handler.
    // - Refresh mechanism called by the setInterval().
    // - User clicking refresh button.
    if (this._fetching) {
      return Promise.resolve(null);
    }

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

    // Splitting a path starting with '/' puts an initial empty element in the array,
    // which we're not interested in. For example, for /datalab/docs, we only want
    // ['datalab', 'docs'].
    if (this._currentCrumbs[0] === '') {
      this._currentCrumbs.splice(0, 1);
    }

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
   * If this element is in "small" mode, double clicking a file does not have
   * an effect, a directory will still navigate.
   */
  _handleDoubleClicked(e: ItemClickEvent) {
    let clickedItem = this._fileList[e.detail.index];
    if (this.small && clickedItem.type !== 'directory') {
      return;
    }
    if (clickedItem.type === 'directory') {
      this.currentPath = clickedItem.path;
      this._pushNewPath();
    } else if (clickedItem.type === 'notebook') {
      this._getNotebookUrlPrefix()
        .then(base => window.open(base + '/' + clickedItem.path, '_blank'));
    } else {
      this._getEditorUrlPrefix()
        .then(base => window.open(base + '/' + clickedItem.path, '_blank'));
    }
  }

  /**
   * Called when the selection changes on the item list. If exactly one file
   * is selected, sets the selectedFile property to the selected file object.
   */
  _handleSelectionChanged() {
    const selectedItems = this.$.files.getSelectedIndices();
    if (selectedItems.length === 1) {
      this.selectedFile = this._fileList[selectedItems[0]];
    } else {
      this.selectedFile = null;
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

  _createNewNotebook() {
    return this._createNewItem('notebook');
  }

  _createNewFile() {
    return this._createNewItem('file');
  }

  _createNewDirectory() {
    return this._createNewItem('directory');
  }

  /**
   * The Jupyter contents API does not provide a way to create a new item with a specific
   * name, it only creates new untitled files or directories in provided path (see
   * https://github.com/jupyter/notebook/blob/master/notebook/services/contents/manager.py#L311).
   * In order to offer a better experience, we create an untitled item in the current path,
   * then rename it to whatever the user specified.
   * 
   * This method creates an input modal to get the user input, then calls the ApiManager to
   * create a new notebook/directory at the current path, and fetches the updated list
   * of files to redraw.
   */
  _createNewItem(type: string) {

    // First, open a dialog to let the user specify a name for the notebook.
    const inputOptions: DialogOptions = {
      title: 'New ' + type, 
      inputLabel: 'Name',
      okLabel: 'Create',
    };

    return Utils.showDialog(InputDialogElement, inputOptions)
      .then((closeResult: InputDialogCloseResult) => {
        // Only if the dialog has been confirmed with some user input, rename the
        // newly created file. Then if that is successful, reload the file list
        if (closeResult.confirmed && closeResult.userInput) {
          let newName = this.currentPath + '/' + closeResult.userInput;
          // Make sure the name ends with .ipynb for notebooks for convenience
          if (type === 'notebook' && !newName.endsWith('.ipynb')) {
            newName += '.ipynb';
          }
          return ApiManager.createNewItem(type, newName)
            .then(() => this._fetchFileList());
        } else {
          return Promise.resolve(null);
        }
      }); // TODO: Handle create errors properly by showing some message to the user
  }

  /**
   * Creates an input modal to get the user input, then calls the ApiManager to
   * rename the currently selected item. This only works if exactly one item is
   * selected.
   */
  _renameSelectedItem() {

    const selectedIndices = this.$.files.getSelectedIndices();
    if (selectedIndices.length === 1) {
      const i = selectedIndices[0];
      const selectedObject = this._fileList[i];

      // Open a dialog to let the user specify the new name for the selected item.
      const inputOptions: DialogOptions = {
        title: 'Rename ' + selectedObject.type.toString(), 
        inputLabel: 'New name',
        inputValue: selectedObject.name,
        okLabel: 'Rename',
      };

      // Only if the dialog has been confirmed with some user input, rename the
      // selected item. Then if that is successful, and reload the file list.
      return Utils.showDialog(InputDialogElement, inputOptions)
        .then((closeResult: InputDialogCloseResult) => {
          if (closeResult.confirmed && closeResult.userInput) {
            const newName = this.currentPath + '/' + closeResult.userInput;
            return ApiManager.renameItem(selectedObject.path, newName)
              .then(() => this._fetchFileList());
              // TODO: [yebrahim] Re-select the renamed item after refresh
          } else {
            return Promise.resolve(null);
          }
        })
        // TODO: Handle rename errors properly by showing some message to the user
    } else {
      return Promise.resolve(null);
    }
  }

  /**
   * Creates a modal to get the user's confirmation with a list of the items
   * to be deleted, then calls the ApiManager for each of these items to delete,
   * then refreshes the file list.
   */
  _deleteSelectedItems() {

    const selectedIndices = this.$.files.getSelectedIndices();
    if (selectedIndices.length) {
      // Build friendly title and body messages that adapt to the number of items.
      const num = selectedIndices.length;
      let title = 'Delete ';

      // Title
      if (num === 1) {
        const i = selectedIndices[0];
        const selectedObject = this._fileList[i];
        title += selectedObject.type.toString();
      } else {
        title += num + ' items';
      }

      // Body
      let itemList = '<ul>\n';
      selectedIndices.forEach((fileIdx: number, i: number) => {
        if (i < FilesElement._deleteListLimit)
          itemList += '<li>' + this._fileList[fileIdx].name + '</li>\n';
      });
      if (num > FilesElement._deleteListLimit) {
        itemList += '+ ' + (num - FilesElement._deleteListLimit) + ' more.';
      }
      itemList += '</ul>'
      const messageHtml = '<div>Are you sure you want to delete:</div>' + itemList;

      // Open a dialog to let the user confirm deleting the list of selected items.
      const inputOptions: DialogOptions = {
        title: title,
        messageHtml: messageHtml,
        okLabel: 'Delete',
      };

      // Only if the dialog has been confirmed, call the ApiManager to delete each
      // of the selected items, and wait for all promises to finish. Then if that
      // is successful, reload the file list.
      return Utils.showDialog(BaseDialogElement, inputOptions)
        .then((closeResult: BaseDialogCloseResult) => {
          if (closeResult.confirmed) {
            let deletePromises = selectedIndices.map((i: number) => {
              return ApiManager.deleteItem(this._fileList[i].path);
            });
            // TODO: [yebrahim] If at least one delete fails, _fetchFileList will never be called,
            // even if some other deletes completed.
            return Promise.all(deletePromises)
              .then(() => this._fetchFileList());
          } else {
            return Promise.resolve(null);
          }
        });
        // TODO: Handle delete errors properly by showing some message to the user
    } else {
      return Promise.resolve(null);
    }
  }

  /**
   * Computes whether the details pane should be enabled. This depends on two values:
   * whether the element has the small attribute, and whether the user has switched it
   * off manually.
   */
  _getDetailsPaneEnabled(small: boolean, toggledOn: boolean) {
    return !small && toggledOn;
  }

  /**
   * Switches details pane on or off.
   */
  _toggleDetailsPane() {
    this._isDetailsPaneToggledOn = !this._isDetailsPaneToggledOn;
  }

  /**
   * Creates a directory picker modal to get the user to choose a destination for the
   * selected item, sends a copy item API call, then refreshes the file list. This only
   * works if exactly one item is selected.
   * TODO: Consider allowing multiple items to be copied.
   */
  _copySelectedItem() {
    const selectedIndices = this.$.files.getSelectedIndices();

    if (selectedIndices.length === 1) {
      const i = selectedIndices[0];
      const selectedObject = this._fileList[i];

      const options: DialogOptions = {
        title: 'Copy Item',
        okLabel: 'Copy Here',
        big: true,
      };
      return Utils.showDialog(DirectoryPickerDialogElement, options)
        .then((closeResult: DirectoryPickerDialogCloseResult) => {
          if (closeResult.confirmed) {
            const newPath = closeResult.directoryPath;
            return ApiManager.copyItem(selectedObject.path, newPath)
              .then(() => this._fetchFileList());
          } else {
            return Promise.resolve(null);
          }
        });
    } else {
      return Promise.resolve(null);
    }
  }

  /**
   * Creates a directory picker modal to get the user to choose a destination for the
   * selected item, sends a rename item API call, then refreshes the file list. This only
   * works if exactly one item is selected.
   * TODO: Consider allowing multiple items to be copied.
   */
  _moveSelectedItem() {
    const selectedIndices = this.$.files.getSelectedIndices();

    if (selectedIndices.length === 1) {
      const i = selectedIndices[0];
      const selectedObject = this._fileList[i];

      const options: DialogOptions = {
        title: 'Move Item',
        okLabel: 'Move Here',
        big: true,
      };
      return Utils.showDialog(DirectoryPickerDialogElement, options)
        .then((closeResult: DirectoryPickerDialogCloseResult) => {
          if (closeResult.confirmed) {
            const newPath = closeResult.directoryPath;
            // Moving is renaming.
            return ApiManager.renameItem(selectedObject.path, newPath + '/' + selectedObject.name)
              .then(() => this._fetchFileList());
          } else {
            return Promise.resolve(null);
          }
        });
    } else {
      return Promise.resolve(null);
    }
  }

  _toggleAltAddToolbar() {
    this.$.altAddToolbar.toggle();
  }

  _toggleAltUpdateToolbar() {
    this.$.altUpdateToolbar.toggle();
  }

  /**
   * Called on window.resize, collapses elements to keep the element usable
   * on small screens.
   */
  _resizeHandler() {
    const width = this.$.toolbar.clientWidth;
    // Collapse the add buttons on the toolbar
    if (width < this._addToolbarCollapseThreshold) {
      Utils.moveElementChildren(this.$.addToolbar, this.$.altAddToolbar);
      this.$.altAddToolbarToggle.style.display = "inline-flex";
    } else {
      Utils.moveElementChildren(this.$.altAddToolbar, this.$.addToolbar);
      this.$.altAddToolbarToggle.style.display = "none";
      this.$.altAddToolbar.close();
    }

    // Collapse the update buttons on the toolbar
    if (width < this._updateToolbarCollapseThreshold) {
      Utils.moveElementChildren(this.$.updateToolbar, this.$.altUpdateToolbar);
      this.$.altUpdateToolbarToggle.style.display = "inline-flex";
    } else {
      Utils.moveElementChildren(this.$.altUpdateToolbar, this.$.updateToolbar);
      this.$.altUpdateToolbarToggle.style.display = "none";
      this.$.altUpdateToolbar.close();
    }

    // Collapse the details pane
    if (width < this._detailsPaneCollapseThreshold) {
      this._isDetailsPaneToggledOn = false;
    }
  }

}

customElements.define(FilesElement.is, FilesElement);
