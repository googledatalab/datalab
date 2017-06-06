class SessionsElement extends Polymer.Element {

  static get is() { return "datalab-sessions"; }

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

}

customElements.define(SessionsElement.is, SessionsElement);

