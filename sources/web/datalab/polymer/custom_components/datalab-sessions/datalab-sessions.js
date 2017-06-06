define(['ApiManager'], ApiManager => {

  class SessionsElement extends Polymer.Element {

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
      let newList = [];
      this.sessionList.forEach(session => {
        newList.push({
          'firstCol': session.notebook.path,
          'secondCol': 'running',
          'icon': 'editor:insert-drive-file'
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
        }, error => {
          console.log('Could not get list of sessions. Using dummy values');
          self.sessionList = [{
            notebook: {
              path: 'the first path'
            }
          }, {
            notebook: {
              path: 'the second path'
            }
          }];
        })
        .then(() => {
          this._fetching = false;
        });
    }

  }

  customElements.define(SessionsElement.is, SessionsElement);

});
