/// <reference path="../../modules/ApiManager.ts" />
/// <reference path="../item-list/item-list.ts" />

/**
 * File listing element for Datalab.
 * Contains an item-list element to display files, a toolbar to interact with these files,
 * a progress bar that appears while loading the file list, and a navigation bar with
 * breadcrumbs
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
   * The current list of navigation bread crumbs
   */
  public currentCrumbs: Array<string>;

  /**
   * The list of files being displayed
   */
  public fileList: Array<ApiFile>;

  private _pathHistory: Array<string>;
  private _pathHistoryIndex: number;
  private _fetching: boolean;
  private _fileListRefreshInterval: number;

  static get is() { return "datalab-files"; }

  static get properties() {
    return {
      basePath: {
        type: String,
        value: '/'
      },
      currentPath: {
        type: String,
        value: '',
        observer: '_currentPathChanged'
      },
      currentCrumbs: {
        type: Array,
        value: function(): Array<string> {
          return []
        }
      },
      fileList: {
        type: Array,
        value: function(): Array<ApiFile> {
          return [];
        },
        observer: '_fileListChanged'
      },
      _pathHistory: {
        type: Array,
        value: function(): Array<string> {
          return [];
        }
      },
      _pathHistoryIndex: {
        type: Number,
        value: -1,
        observer: '_pathHistoryIndexChanged'
      },
      _fetching: {
        type: Boolean,
        value: false
      },
      _fileListRefreshInterval: {
        type: Number,
        value: 10000
      }
    }
  }

  /**
   * called when when the component is attached to the DOM
   */
  connectedCallback() {
    super.connectedCallback();
    const listElement = this._getFileListElement();
    listElement.columns = ['Name', 'Status'];
    // refresh the file list periodically
    setInterval(this._loadFileList.bind(this), this._fileListRefreshInterval);
  }

  _getNotebookUrlPrefix() {
    let prefix = location.protocol + '//' + location.host + '/';
    return prefix + 'notebooks';
  }

  _getFileListElement() {
    return this.$.files;
  }

  _loadFileList() {
    const self = this;
    self._fetching = true;
    return ApiManager.listFilesAsync(this.basePath + this.currentPath)
      .then(list => {
        self.fileList = list;
      }, () => {
        console.log('Error getting list of files.');
      })
      .then(() => {
        this._fetching = false;
      });
  }

  _currentPathChanged(_: string, oldValue: string) {
    // on initialization, push this value to path history
    if (oldValue === undefined) {
      this._pushNewPath();
    }

    let crumbs = this.currentPath.split('/');
    if (crumbs[0] === '') {
      crumbs.shift();
    }
    this.currentCrumbs = crumbs;

    return this._loadFileList();
  }

  _fileListChanged() {
    // initial value
    if (!Array.isArray(this.fileList)) {
      return;
    }

    const listElement = this._getFileListElement();
    let newList: Array<ItemListRow> = [];
    this.fileList.forEach(file => {
      newList.push({
        firstCol: file.name,
        secondCol: file.status,
        icon: file.type === 'directory' ? 'folder' : 'editor:insert-drive-file',
        selected: false
      });
    });
    listElement.rows = newList;
  }

  ready() {
    super.ready();
    const filesElement = this.shadowRoot.querySelector('#files')
    if (filesElement) {
      filesElement.addEventListener('itemDblClick', this._handleDblClicked.bind(this));
    }
  }

  _handleDblClicked(e: DoubleClickEvent) {
    let clickedItem = this.fileList[e.detail.index];
    if (clickedItem.type === 'directory') {
      this.currentPath = clickedItem.path;
      this._pushNewPath();
    } else {
      window.open(this._getNotebookUrlPrefix() + '/' + clickedItem.path, '_blank');
    }
  }

  _crumbClicked(e: MouseEvent) {
    const target = <HTMLDivElement>e.target;
    if (target.id === 'home-crumb') {
      this.currentPath = '';
    } else {
      const clickedCrumb = this.$.breadcrumbsTemplate.indexForElement(e.target);
      this.currentPath = this.currentCrumbs.slice(0, clickedCrumb + 1).join('/');
    }
    this._pushNewPath();
  }

  _pushNewPath() {
    // purge all items in the array past _pathHistoryIndex
    this._pathHistory.splice(this._pathHistoryIndex + 1);
    if (!this._pathHistory.length ||
        this._pathHistory[this._pathHistory.length - 1] !== this.currentPath) {
      this._pathHistory.push(this.currentPath);
      this._pathHistoryIndex = this._pathHistory.length - 1;
    }
  }

  _navBackward() {
    this._pathHistoryIndex -= 1;
    this.currentPath = this._pathHistory[this._pathHistoryIndex];
  }

  _navForward() {
    this._pathHistoryIndex += 1;
    this.currentPath = this._pathHistory[this._pathHistoryIndex];
  }

  _pathHistoryIndexChanged() {
    // enable/disable nav buttons
    this.$.backNav.disabled = this._pathHistoryIndex === 0;
    this.$.forwardNav.disabled = this._pathHistoryIndex === this._pathHistory.length - 1;
  }

}

customElements.define(FilesElement.is, FilesElement);

