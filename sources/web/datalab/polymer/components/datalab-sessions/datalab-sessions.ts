import { ApiManager, Session } from '../../modules/ApiManager'
import { ItemListRow } from '../item-list/item-list'

define('datalab-sessions', ['ApiManager'], () => {

  /**
   * Session listing element for Datalab.
   * Contains an item-list element to display sessions, a toolbar to interact with these sessions,
   * a progress bar that appears while loading the list
   */
  class SessionsElement extends Polymer.Element {

    /**
     * The list of sessions being displayed
     */
    public sessionList: Array<Session>;

    private _fetching: boolean;
    private _sessionListRefreshInterval: number;

    static get is() { return "datalab-sessions"; }

    static get properties() {
      return {
        sessionList: {
          type: Array,
          value: function() {
            return [];
          },
          observer: '_sessionListChanged'
        },
        _fetching: {
          type: Boolean,
          value: false
        },
        _sessionListRefreshInterval: {
          type: Number,
          value: 10000
        }
      }
    }

    connectedCallback() {
      super.connectedCallback();
      const listElement = this._getSessionListElement();
      listElement.columns = ['Session Path', 'Status'];

      // load session list initially
      this._loadSessionsList();

      // refresh the session list periodically
      setInterval(this._loadSessionsList.bind(this), this._sessionListRefreshInterval);
    }

    _getSessionListElement() {
      return this.$.sessions;
    }

    _sessionListChanged() {
      // initial value
      if (!Array.isArray(this.sessionList)) {
        return;
      }

      const listElement = this._getSessionListElement();
      let newList: Array<ItemListRow> = [];
      this.sessionList.forEach(session => {
        newList.push({
          firstCol: session.notebook.path,
          secondCol: 'running',
          icon: 'editor:insert-drive-file',
          selected: false
        });
      });
      listElement.rows = newList;
    }

    _loadSessionsList() {
      const self = this;
      self._fetching = true;
      return ApiManager.listSessionsAsync()
        .then(list => {
          self.sessionList = list;
        }, () => {
          console.log('Error getting list of sessions.');
        })
        .then(() => {
          this._fetching = false;
        });
    }

  }

  customElements.define(SessionsElement.is, SessionsElement);

});
