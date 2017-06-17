/**
 * Details pane element for Datalab.
 * This element is designed to be displayed in a side bar that displays more
 * information about a selected file
 */
class DetailsPaneElement extends Polymer.Element {

  /**
   * File whose details to show.
   */
  public file: ApiFile;

  static get is() { return "details-pane"; }

  static get properties() {
    return {
      file: {
        type: Object,
        value: {}
      },
      _icon: {
        type: String,
        computed: '_getIcon(file)',
      },
      _created: {
        type: String,
        computed: '_getCreated(file)',
      },
      _modified: {
        type: String,
        computed: '_getModified(file)',
      },
    }
  }

  _getIcon() {
    if (this.file) {
      return this.file.type === 'directory' ? 'folder' : 'editor:insert-drive-file';
    } else {
      return '';
    }
  }
  _getCreated() {
    return this.file ? new Date(this.file.created).toLocaleDateString() : '';
  }
  _getModified() {
    return this.file ? new Date(this.file.last_modified).toLocaleDateString() : '';
  }

}

customElements.define(DetailsPaneElement.is, DetailsPaneElement);

