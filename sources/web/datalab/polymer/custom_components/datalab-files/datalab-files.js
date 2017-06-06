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
      }
    }
  }

  _getFileListElement() {
    return this.$.files;
  }

  _currentPathChanged(newValue) {
    const self = this;

    let crumbs = this.currentPath.split('/');
    if (crumbs[0] === '') {
      crumbs.shift();
    }
    this.currentCrumbs = crumbs;

    ContentManager.listFilesAsync(this.basePath + this.currentPath)
      .then(list => {
        self.fileList = list;
      }, error => {
        console.log('Could not get list of files. Using dummy values');
        self.fileList = [{
          'name': 'the first item',
          'path': 'first path',
          'status': 'hello'
        }, {
          'name': 'the second item',
          'path': 'second path',
          'status': 'hello'
        }, {
          'name': 'the third item',
          'path': 'third path',
          'status': ''
        }, {
          'name': 'the forth item',
          'path': 'forth path',
          'status': 'hello'
        }];
      });
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
        'status': ''
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
    let newPath = this.fileList[e.detail.index].path;
    this.currentPath = newPath;
  }

  _crumbClicked(e) {
    if (e.target.id === 'home-crumb') {
      this.currentPath = '';
    } else {
      let newPath = this.basePath;
      const clickedCrumb = this.$.breadcrumbsTemplate.indexForElement(e.target);
      this.currentPath = this.currentCrumbs.slice(0, clickedCrumb + 1).join('/');
    }
  }

  _navBackward() {
  }

  _navForward() {
  }

}

customElements.define(FilesElement.is, FilesElement);

