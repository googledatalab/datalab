class FilesElement extends Polymer.Element {

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
        value: function() {
          []
        }
      },
      fileList: {
        type: Object,
        value: {},
        observer: '_fileListChanged'
      },
      _pathHistory: {
        type: Array,
        value: function() {
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

  connectedCallback() {
    super.connectedCallback();
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
    return ContentManager.listFilesAsync(this.basePath + this.currentPath)
      .then(list => {
        self.fileList = list;
      }, error => {
        console.log('Could not get list of files. Using dummy values');
        self.fileList = [{
          'name': 'the first item',
          'path': 'first path',
          'type': 'directory',
          'status': 'hello'
        }, {
          'name': 'the second item',
          'path': 'second path',
          'type': 'directory',
          'status': 'hello'
        }, {
          'name': 'the third item',
          'path': 'third path',
          'type': 'directory',
          'status': ''
        }, {
          'name': 'the forth item',
          'path': 'forth path',
          'type': 'notebook',
          'status': 'hello'
        }];
      })
      .then(() => {
        this._fetching = false;
      });
  }

  _currentPathChanged(newValue, oldValue) {
    this._fetching = true;

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

    const picker = this._getFileListElement();
    let newList = [];
    this.fileList.forEach(file => {
      newList.push({
        'name': file.name,
        'status': file.status,
        'icon': file.type === 'directory' ? 'folder' : 'editor:insert-drive-file'
      });
    });
    picker.rows = newList;
  }

  ready() {
    super.ready();
    this.shadowRoot.querySelector('#files').addEventListener('itemDblClick',
                                                             this._handleDblClicked.bind(this));
  }

  _handleDblClicked(e) {
    let clickedItem = this.fileList[e.detail.index];
    if (clickedItem.type === 'directory') {
      this.currentPath = clickedItem.path;
      this._pushNewPath();
    } else {
      window.open(this._getNotebookUrlPrefix() + '/' + clickedItem.path, '_blank');
    }
  }

  _crumbClicked(e) {
    if (e.target.id === 'home-crumb') {
      this.currentPath = '';
    } else {
      let newPath = this.basePath;
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

