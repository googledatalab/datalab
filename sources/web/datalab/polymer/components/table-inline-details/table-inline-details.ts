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

/**
 * Table inline details pane element for Datalab.
 * Displays information about the selected BigQuery table file inline in the
 * file browser item list.
 */
@Polymer.decorators.customElement('table-inline-details')
class TableInlineDetailsElement extends Polymer.Element {

  /**
   * File whose details to show.
   */
  @Polymer.decorators.property({type: Object})
  public file: BigQueryFile;

  @Polymer.decorators.property({computed: '_computeSchemaFields(_table)', type: Array})
  _schemaFields: gapi.client.bigquery.Field[];

  @Polymer.decorators.property({type: Array, notify: true}) // Notify for unit tests
  _rows: gapi.client.bigquery.TabledataRow[] = [];

  @Polymer.decorators.property({type: Object, notify: true})
  _table: gapi.client.bigquery.Table | null = null;

  @Polymer.decorators.property({type: String})
  _tableMessage = '';

  @Polymer.decorators.property({type: Boolean})
  _busy = false;

  _fileManager: FileManager;

  private readonly TABLE_PREVIEW_ROW_COUNT = 5;

  constructor() {
    super();

    this._fileManager = FileManagerFactory.getInstance();
  }

  @Polymer.decorators.observe('file')
  _fileChanged() {
    const path = this.file && this.file.id && this.file.id.path;
    const pathParts = path ? path.split('/') : [];

    if (pathParts.length === 3) {
      this._loadTable(pathParts);
    } else {
      this._table = null;
      this._rows = [];
    }
  }

  async _loadTable(pathParts: string[]) {
    this._busy = true;

    const projectId = pathParts[0];
    const datasetId = pathParts[1];
    const tableId = pathParts[2];

    this._tableMessage = '';

    await GapiManager.bigquery.getTableDetails(projectId, datasetId, tableId)
      .then((response: HttpResponse<gapi.client.bigquery.Table>) => {
        this._table = response.result;
      }, (errorResponse: any) => {
        // TODO - display error to user in the details pane
        this._table = null;
        Utils.log.error('Failed to get table details: ' + errorResponse.body);
      });

    if (this._table) {
      if (this._table.type === 'VIEW') {
        // BigQuery does not support the getTableRows call on views, as it has
        // to execute the defining query to get the contents. We don't want to
        // automatically load the view, as the underlying query could be
        // arbitrarily complex and thus expensive.
        this._tableMessage = 'Preview is not available for Views';
      } else {
        await GapiManager.bigquery.getTableRows(
              projectId, datasetId, tableId, this.TABLE_PREVIEW_ROW_COUNT)
          .then((response: HttpResponse<gapi.client.bigquery.ListTabledataResponse>) => {
            this._rows = response.result.rows;
            this.show();
          }, (errorResponse: any) => {
            // TODO - display error to user in the details pane
            this._rows = [];
            Utils.log.error('Failed to get table rows: ' + errorResponse.body);
          });
      }
    }

    this._busy = false;
  }

  /**
   * Dispatches an event when our details have been loaded.
   */
  show() {
    const eventFields = {
      file: this.file,
      openInNotebook: this._openInNotebook.bind(this)
    };
    const e =
        new CustomEvent('inline-details-loaded', {detail: eventFields});
    document.dispatchEvent(e);
  }

  _computeSchemaFields(table: gapi.client.bigquery.Table | null) {
    return table ? Utils.flattenFields(table.schema.fields) : [];
  }

  /**
   * Opens the current table in the table schema template notebook.
   */
  async _openInNotebook() {

    if (this._table) {
      const dict = {
        BIGQUERY_DATASET_ID: this._table.tableReference.datasetId || '',
        BIGQUERY_FULL_ID: this._table.id.replace(':', '.') || '',
        BIGQUERY_PROJECT_ID: this._table.tableReference.projectId || '',
        BIGQUERY_TABLE_DESCRIPTION: this._table.description || '',
        BIGQUERY_TABLE_ID: this._table.tableReference.tableId || '',
      };

      const appSettings = await SettingsManager.getAppSettingsAsync();

      // TODO(jimmc): Look for a user preference for baseDir
      const baseType = (appSettings.defaultFileManager || 'drive');
      const baseDir = baseType + '/';
      // TODO(jimmc): Allow specifying a path with baseDir. For now, we are
      // just using the root of the filesystem as the default location.
      const baseName = 'temp';
      // Add some more stuff to the name to make it different each time.
      // We are not checking to see if the file exists, so it is not
      // guaranteed to produce a unique filename, but since we are doing
      // it based on the current time down to the second, and it is scoped
      // only to this user, the odds of a collision are pretty low.
      const dateStr = new Date().toISOString();
      const yearStr =
          dateStr.slice(0, 4) + dateStr.slice(5, 7) + dateStr.slice(8, 10);
      const timeStr =
          dateStr.slice(11, 13) + dateStr.slice(14, 16) + dateStr.slice(17, 19);
      const moreName = yearStr + '_' + timeStr;
      const fileName = baseName + '_' + moreName + '.ipynb';
      const options: DirectoryPickerDialogOptions = {
        big: true,
        fileId: baseDir,
        fileName,
        okLabel: 'Save Here',
        title: 'New Notebook',
        withFileName: true,
      };

      const closeResult =
          await Utils.showDialog(DirectoryPickerDialogElement, options) as
              DirectoryPickerDialogCloseResult;

      if (closeResult.confirmed && closeResult.fileName) {
        let instanceName = closeResult.fileName;
        if (!instanceName.endsWith('.ipynb')) {
          instanceName += '.ipynb';
        }

        const params = encodeURIComponent(JSON.stringify(dict));
        const url = Utils.getHostRoot() + Utils.constants.newNotebookUrlComponent +
            closeResult.selectedDirectory.id.toString() + '?fileName=' + instanceName +
            '&templateName=' + TEMPLATE_NAME.bigqueryOverview + '&params=' + params;
        window.open(url, '_blank');
      }
    }
  }
}
