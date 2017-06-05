class FilesElement extends Polymer.Element {

  static get is() { return "datalab-files"; }

  static get properties() {
    return {
      currentPath: {
        type: String,
        value: '/',
        observer: '_currentPathChanged'
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
    ContentManager.listFilesAsync(this.currentPath)
      .then(list => {
        try {
          list = JSON.parse(list);
          self.fileList = list;
        } catch(e) {
          console.log('Could not get list of files');
        }
      });
  }

  _fileListChanged() {
    // initial undefined value
    if (!this.fileList.content) {
      return;
    }

    const picker = this._getFileListElement();
    let newList = [];
    this.fileList.content.forEach(file => {
      newList.push({
        'name': file.name,
        'status': ''
      });
    });
    picker.rows = newList;
  }

}

customElements.define(FilesElement.is, FilesElement);

