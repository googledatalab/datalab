class FilesElement extends Polymer.Element {

  static get is() { return "datalab-files"; }

  static get properties() {
    return {
      currentPath: {
        type: String,
        value: '/',
        observer: '_currentPathChanged'
      }
    }
  }

  _currentPathChanged(newValue) {
    ContentManager.listFiles('/');
  }

}

customElements.define(FilesElement.is, FilesElement);

