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

  private static readonly _deleteListLimit = 10;

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

  private _pathHistory: string[];
  private _pathHistoryIndex: number;
  private _fetching: boolean;
  private _fileList: ApiFile[];
  private _fileListRefreshInterval = 60 * 1000;
  private _fileListRefreshIntervalHandle = 0;
  private _currentCrumbs: string[];
  private _isDetailsPaneToggledOn: boolean;
  private _addToolbarCollapseThreshold = 900;
  private _updateToolbarCollapseThreshold = 720;
  private _detailsPaneCollapseThreshold = 600;
  private _uploadFileSizeWarningLimit = 25 * 1024 * 1024;

  static get is() { return 'datalab-files'; }

  static get properties() {
    return {
      _currentCrumbs: {
        type: Array,
        value: () => [],
      },
      _fetching: {
        type: Boolean,
        value: false,
      },
      _fileList: {
        type: Array,
        value: () => [],
      },
      _isDetailsPaneEnabled: {
        computed: '_getDetailsPaneEnabled(small, _isDetailsPaneToggledOn)',
        type: Boolean,
      },
      _isDetailsPaneToggledOn: {
        type: Boolean,
        value: true,
      },
      _pathHistory: {
        type: Array,
        value: () => [],
      },
      _pathHistoryIndex: {
        observer: '_pathHistoryIndexChanged',
        type: Number,
        value: -1,
      },
      basePath: {
        type: String,
        value: '/',
      },
      currentPath: {
        observer: '_currentPathChanged',
        type: String,
        value: '',
      },
      selectedFile: {
        type: Object,
        value: null,
      },
      small: {
        type: Boolean,
        value: false,
      },
    };
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

        this._resizeHandler();
        this._focusHandler();
      });

    const filesElement = this.shadowRoot.querySelector('#files');
    if (filesElement) {
      filesElement.addEventListener('itemDoubleClick',
                                    this._handleDoubleClicked.bind(this));
      filesElement.addEventListener('selected-indices-changed',
                                    this._handleSelectionChanged.bind(this));
    }

    // For a small file/directory picker, we don't need to show the status.
    (this.$.files as ItemListElement).columns = this.small ? ['Name'] : ['Name', 'Status'];
  }

  disconnectedCallback() {
    // Clean up the refresh interval. This is important if multiple datalab-files elements
    // are created and destroyed on the document.
    clearInterval(this._fileListRefreshIntervalHandle);
  }

  async _getNotebookUrlPrefix() {
    // Notebooks that are stored on the VM require the basepath.
    const basepath = await ApiManager.getBasePath();
    const prefix = location.protocol + '//' + location.host + basepath + '/';
    return prefix + 'notebooks';
  }

  async _getEditorUrl(filePath?: string) {
    // Files that are stored on the VM require the basepath.
    const basepath = await ApiManager.getBasePath();
    let url = location.protocol + '//' + location.host + basepath + '/editor';
    if (filePath) {
      url += '?file=' + filePath;
    }
    return url;
  }

  /**
   * Calls the ApiManager to get the list of files at the current path, and
   * updates the fileList property.
   * @param throwOnError whether to throw an exception if the refresh fails. This
   *                     is false by default because throwing is currently not used.
   */
  _fetchFileList(throwOnError = false) {
    // Don't overlap fetch requests. This can happen because we set up fetch from several sources:
    // - Initialization in the ready() event handler.
    // - Refresh mechanism called by the setInterval().
    // - User clicking refresh button.
    // - Files page gaining focus.
    if (this._fetching) {
      return Promise.resolve(null);
    }
    this._fetching = true;

    return ApiManager.listFilesAsync(this.basePath + this.currentPath)
      .then((newList) => {
        // Only refresh the UI list if there are any changes. This helps keep
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
      })
      .catch((e: Error) => {
        if (throwOnError === true) {
          throw new Error('Error getting list of files: ' + e.message);
        }
      })
      .then(() => this._fetching = false);
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
    (this.$.files as ItemListElement).rows = this._fileList.map((file) => {
      return {
        firstCol: file.name,
        icon: file.type === 'directory' ? 'folder' : 'editor:insert-drive-file',
        secondCol: file.status,
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
    const clickedItem = this._fileList[e.detail.index];
    if (this.small && clickedItem.type !== 'directory') {
      return;
    }
    if (clickedItem.type === 'directory') {
      this.currentPath = clickedItem.path;
      this._pushNewPath();
    } else if (clickedItem.type === 'notebook') {
      this._getNotebookUrlPrefix()
        .then((prefix) => window.open(prefix + '/' + clickedItem.path, '_blank'));
    } else {
      this._getEditorUrl(clickedItem.path)
        .then((url) => window.open(url, '_blank'));
    }
  }

  /**
   * Called when the selection changes on the item list. If exactly one file
   * is selected, sets the selectedFile property to the selected file object.
   */
  _handleSelectionChanged() {
    const selectedIndices = (this.$.files as ItemListElement).selectedIndices;
    if (selectedIndices.length === 1) {
      this.selectedFile = this._fileList[selectedIndices[0]];
    } else {
      this.selectedFile = null;
    }
  }

  /**
   * Navigates to the path of the clicked breadcrumb.
   */
  _crumbClicked(e: MouseEvent) {
    const target = e.target as HTMLDivElement;
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
   * This is the entry point for file upload functionality. This is here to avoid using
   * the very ugly <input> element for file uploads.
   */
  _altUpload() {
    this.$.altFileUpload.click();
  }

  /**
   * Gets called after the user selected one or more files from the upload modal.
   * For each of the selected files, reads its contents, converts it to base64, then
   * uses the ApiManager to save it on the backend.
   */
  async _upload() {
    const inputElement = this.$.altFileUpload as HTMLInputElement;
    const files = [...inputElement.files as any];
    const currentPath = this.currentPath;
    const uploadPromises: Array<Promise<any>> = [];

    // TODO: Check if the file already exists at the current path, otherwise the upload
    // might still occur (Jupyter overwrites by default).

    // Find out if there's at least one large file.
    const hasLargeFile = files.some((file: File) =>
        file.size > this._uploadFileSizeWarningLimit);

    // If there's at least one large file, show a dialog to confirm the user
    // wants to continue with the upload.
    if (hasLargeFile) {
      let warningMsg = files.length > 1 ? 'Some of the files you selected are '
                                          : 'The file you selected is ';
      warningMsg += 'larger than 25MB. You might experience browser freeze or crash.';
      const dialogOptions: DialogOptions = {
        messageHtml: warningMsg,
        okLabel: 'Upload Anyway',
        title: 'Warning: Large File',
      };

      const result: BaseDialogCloseResult =
        await Utils.showDialog(BaseDialogElement, dialogOptions);

      if (result.confirmed === false) {
        // Reset the input element.
        inputElement.value = '';
        return;
      }
    }

    files.forEach((file: File) => {

      // First, load the file data into memory.
      const readPromise = new Promise((resolve, reject) => {

        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        // TODO: handle file reading errors.
        reader.onerror = () => {
          reject(new Error('Error reading file.'));
        };

        // TODO: this will freeze the UI on large files (>~20MB on my laptop) until
        // they're loaded into memory, and very large files (>~100MB) will crash
        // the browser.
        // One possible solution is to slice the file into small chunks and upload
        // each separately, but this requires the backend to support partial
        // chunk uploads. For Jupyter, this is supported in 5.0.0, see:
        // https://github.com/jupyter/notebook/pull/2162/files
        reader.readAsDataURL(file);
      });

      // Now upload the file data to the backend server.
      const uploadPromise = readPromise
        .then((itemData: string) => {
          // Extract the base64 data string
          itemData = itemData.substr(itemData.indexOf(',') + 1);

          const model: JupyterFile = {
            content: itemData,
            format: 'base64',
            name: file.name,
            path: currentPath,
            type: 'file',
          };
          return ApiManager.saveJupyterFile(model);
        });
      uploadPromises.push(uploadPromise);
    });

    // Wait on all upload requests before declaring success or failure.
    try {
      await Promise.all(uploadPromises);
      if (uploadPromises.length) {
        // Dispatch a success notification, and refresh the file list
        const message = files.length > 1 ? files.length + ' files' : files[0].name;
        this.dispatchEvent(new NotificationEvent(message + ' uploaded successfully.'));

        this._fetchFileList();
      }
      // Reset the input element.
      inputElement.value = '';
    } catch (e) {
      Utils.showErrorDialog('Error uploading file', e.message);
    }
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
      inputLabel: 'Name',
      okLabel: 'Create',
      title: 'New ' + type,
    };

    return Utils.showDialog(InputDialogElement, inputOptions)
      .then((closeResult: InputDialogCloseResult) => {
        // Only if the dialog has been confirmed with some user input, rename the
        // newly created file. Then if that is successful, reload the file list
        if (closeResult.confirmed && closeResult.userInput) {
          let newName = closeResult.userInput;
          // Make sure the name ends with .ipynb for notebooks for convenience
          if (type === 'notebook' && !newName.endsWith('.ipynb')) {
            newName += '.ipynb';
          }

          return ApiManager.createNewItem(type, this.currentPath + '/' + newName)
            .then(() => {
              // Dispatch a success notification, and refresh the file list
              this.dispatchEvent(new NotificationEvent('Created ' + newName + '.'));
              this._fetchFileList();
            })
            .catch((e: Error) => Utils.showErrorDialog('Error creating item', e.message));
        } else {
          return Promise.resolve(null);
        }
      });
  }

  /**
   * Opens the selected item in the text editor.
   */
  _openSelectedInEditor() {
    const filesElement = this.$.files as ItemListElement;
    const selectedIndices = filesElement.selectedIndices;
    if (selectedIndices.length === 1) {
      const i = selectedIndices[0];
      const selectedObject = this._fileList[i];

      this._getEditorUrl(selectedObject.path)
        .then((url) => window.open(url, '_blank'));
    }
  }

  /**
   * Creates an input modal to get the user input, then calls the ApiManager to
   * rename the currently selected item. This only works if exactly one item is
   * selected.
   */
  _renameSelectedItem() {

    const selectedIndices = (this.$.files as ItemListElement).selectedIndices;
    if (selectedIndices.length === 1) {
      const i = selectedIndices[0];
      const selectedObject = this._fileList[i];

      // Open a dialog to let the user specify the new name for the selected item.
      const inputOptions: DialogOptions = {
        inputLabel: 'New name',
        inputValue: selectedObject.name,
        okLabel: 'Rename',
        title: 'Rename ' + selectedObject.type.toString(),
      };

      // Only if the dialog has been confirmed with some user input, rename the
      // selected item. Then if that is successful, and reload the file list.
      return Utils.showDialog(InputDialogElement, inputOptions)
        .then((closeResult: InputDialogCloseResult) => {
          if (closeResult.confirmed && closeResult.userInput) {
            const newName = this.currentPath + '/' + closeResult.userInput;

            return ApiManager.renameItem(selectedObject.path, newName)
              .then(() => {
                // Dispatch a success notification, and refresh the file list
                const message = 'Renamed ' + selectedObject.name +
                    ' to ' + closeResult.userInput + '.';
                this.dispatchEvent(new NotificationEvent(message));
                this._fetchFileList();
              })
              .catch((e: Error) => Utils.showErrorDialog('Error renaming item', e.message));
          } else {
            return Promise.resolve(null);
          }
        });
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

    const selectedIndices = (this.$.files as ItemListElement).selectedIndices;
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
        if (i < FilesElement._deleteListLimit) {
          itemList += '<li>' + this._fileList[fileIdx].name + '</li>\n';
        }
      });
      if (num > FilesElement._deleteListLimit) {
        itemList += '+ ' + (num - FilesElement._deleteListLimit) + ' more.';
      }
      itemList += '</ul>';
      const messageHtml = '<div>Are you sure you want to delete:</div>' + itemList;

      // Open a dialog to let the user confirm deleting the list of selected items.
      const inputOptions: DialogOptions = {
        messageHtml,
        okLabel: 'Delete',
        title,
      };

      // Only if the dialog has been confirmed, call the ApiManager to delete each
      // of the selected items, and wait for all promises to finish. Then if that
      // is successful, reload the file list.
      return Utils.showDialog(BaseDialogElement, inputOptions)
        .then((closeResult: BaseDialogCloseResult) => {
          if (closeResult.confirmed) {
            const deletePromises = selectedIndices.map((i: number) => {
              return ApiManager.deleteItem(this._fileList[i].path);
            });
            // TODO: [yebrahim] If at least one delete fails, _fetchFileList will never be called,
            // even if some other deletes completed.
            return Promise.all(deletePromises)
              .then(() => {
                // Dispatch a success notification, and refresh the file list
                const message = 'Deleted ' + num + (num === 1 ? ' file.' : 'files.');
                this.dispatchEvent(new NotificationEvent(message));
                this._fetchFileList();
              })
              .catch((e: Error) => Utils.showErrorDialog('Error deleting item', e.message));
          } else {
            return Promise.resolve(null);
          }
        });
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

    const selectedIndices = (this.$.files as ItemListElement).selectedIndices;

    if (selectedIndices.length === 1) {
      const i = selectedIndices[0];
      const selectedObject = this._fileList[i];

      const options: DialogOptions = {
        big: true,
        okLabel: 'Copy Here',
        title: 'Copy Item',
      };
      return Utils.showDialog(DirectoryPickerDialogElement, options)
        .then((closeResult: DirectoryPickerDialogCloseResult) => {
          if (closeResult.confirmed) {
            return ApiManager.copyItem(selectedObject.path, closeResult.directoryPath)
              .then((newItem: JupyterFile) => {
                // Dispatch a success notification, and refresh the file list
                const message = 'Copied ' + selectedObject.path + ' to ' + newItem.path;
                this.dispatchEvent(new NotificationEvent(message));
                this._fetchFileList();
              })
              .catch((e: Error) => Utils.showErrorDialog('Error copying item', e.message));
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
   * TODO: Consider allowing multiple items to be moved.
   */
  _moveSelectedItem() {

    const selectedIndices = (this.$.files as ItemListElement).selectedIndices;

    if (selectedIndices.length === 1) {
      const i = selectedIndices[0];
      const selectedObject = this._fileList[i];

      const options: DialogOptions = {
        big: true,
        okLabel: 'Move Here',
        title: 'Move Item',
      };
      return Utils.showDialog(DirectoryPickerDialogElement, options)
        .then((closeResult: DirectoryPickerDialogCloseResult) => {
          if (closeResult.confirmed) {
            // Moving is renaming.
            return ApiManager.renameItem(selectedObject.path,
                                         closeResult.directoryPath + '/' + selectedObject.name)
              .then((newItem: JupyterFile) => {
                // Dispatch a success notification, and refresh the file list
                const message = 'Moved ' + selectedObject.path + ' to ' + newItem.path;
                this.dispatchEvent(new NotificationEvent(message));
                this._fetchFileList();
              })
              .catch((e: Error) => Utils.showErrorDialog('Error moving item', e.message));
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
      this.$.altAddToolbarToggle.style.display = 'inline-flex';
    } else {
      Utils.moveElementChildren(this.$.altAddToolbar, this.$.addToolbar);
      this.$.altAddToolbarToggle.style.display = 'none';
      this.$.altAddToolbar.close();
    }

    // Collapse the update buttons on the toolbar
    if (width < this._updateToolbarCollapseThreshold) {
      Utils.moveElementChildren(this.$.updateToolbar, this.$.altUpdateToolbar);
      this.$.altUpdateToolbarToggle.style.display = 'inline-flex';
    } else {
      Utils.moveElementChildren(this.$.altUpdateToolbar, this.$.updateToolbar);
      this.$.altUpdateToolbarToggle.style.display = 'none';
      this.$.altUpdateToolbar.close();
    }

    // Collapse the details pane
    if (width < this._detailsPaneCollapseThreshold) {
      this._isDetailsPaneToggledOn = false;
    }
  }

  /**
   * Starts auto refreshing the file list, and also triggers an immediate refresh.
   */
  _focusHandler() {
    // Refresh the file list periodically. Note that we don't rely solely on the
    // interval to keep the list in sync, the refresh also happens after file
    // operations, and when the files page gains focus.
    if (!this._fileListRefreshIntervalHandle) {
      this._fileListRefreshIntervalHandle =
          setInterval(this._fetchFileList.bind(this), this._fileListRefreshInterval);
    }
    // Now refresh the list once.
    this._fetchFileList();
  }

  /**
   * Stops the auto refresh of the file list. This happens when the user moves
   * away from the page.
   */
  _blurHandler() {
    if (this._fileListRefreshIntervalHandle) {
      clearInterval(this._fileListRefreshIntervalHandle);
      this._fileListRefreshIntervalHandle = 0;
    }
  }

}

customElements.define(FilesElement.is, FilesElement);
