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

type ListDatasetsResponse = gapi.client.bigquery.ListDatasetsResponse;
type ListProjectsResponse = gapi.client.bigquery.ListProjectsResponse;
type ListTablesResponse = gapi.client.bigquery.ListTablesResponse;
type DatasetResource = gapi.client.bigquery.DatasetResource;
type ProjectResource = gapi.client.bigquery.ProjectResource;
type TableResource = gapi.client.bigquery.TableResource;
type ResourceManagerProject = gapi.client.cloudresourcemanager.Project;

class BigQueryFile extends DatalabFile {
  public getInlineDetailsName(): string {
    if (this.type === DatalabFileType.FILE) {
      return 'table';
    }
    return '';
  }

  public getPreviewName(): string {
    if (this.type === DatalabFileType.FILE) {
      return 'table';
    }
    return '';
  }
}

/**
 * A file manager that wraps the BigQuery API so that we can browse BQ projects,
 * datasets, and tables like a filesystem.
 */
class BigQueryFileManager extends BaseFileManager {
  public get(fileId: DatalabFileId): Promise<DatalabFile> {
    if (fileId.path === '/') {
      return Promise.resolve(this._bqRootDatalabFile());
    }
    throw new UnsupportedMethod('get', this);
  }

  public getStringContent(_fileId: DatalabFileId, _asText?: boolean): Promise<string> {
    throw new UnsupportedMethod('getContent', this);
  }

  public async getRootFile() {
    return this.get(new DatalabFileId('/', this.myFileManagerType()));
  }

  public saveText(_file: DatalabFile, _content: string): Promise<DatalabFile> {
    throw new UnsupportedMethod('saveText', this);
  }

  public list(containerId: DatalabFileId): Promise<DatalabFile[]> {
    // BigQuery does not allow slashes in the names of projects,
    // datasets, or tables, so we use them as separator characters
    // to keep consistent with POSIX file hierarchies.
    // We also filter out blank entries, which "collapses" consecutive
    // slashes. It also means both '' and '/' turn into an empty
    // array of pathParts and are thus interpreted as the root.
    const pathParts = containerId.path.split('/').filter((part) => !!part);
    if (pathParts.length === 0) {
      return this._listProjects();
    }
    if (pathParts.length === 1) {
      return this._listDatasets(pathParts[0]);
    }
    if (pathParts.length === 2) {
      return this._listTables(pathParts[0], pathParts[1]);
    }
    throw new UnsupportedMethod('list on BigQuery table', this);
  }

  public getColumns(currentFileId?: DatalabFileId): Column[] {
    if (currentFileId) {
      const len = currentFileId.path.split('/').filter((t) => !!t).length;
      let columnName = '';
      switch (len) {
        case 0: columnName = Utils.constants.columns.project; break;
        case 1: columnName = Utils.constants.columns.dataset; break;
        case 2: columnName = Utils.constants.columns.table; break;
        default: return super.getColumns();
      }
      return [{
        name: columnName,
        type: ColumnTypeName.STRING,
      }];
    } else {
      return super.getColumns();
    }
  }

  public create(_fileType: DatalabFileType, _containerId: DatalabFileId, _name: string):
      Promise<DatalabFile> {
    throw new UnsupportedMethod('create', this);
  }

  public rename(_oldFileId: DatalabFileId, _name: string, _newContainerId?: DatalabFileId):
      Promise<DatalabFile> {
    throw new UnsupportedMethod('rename', this);
  }

  public delete(_fileId: DatalabFileId): Promise<boolean> {
    throw new UnsupportedMethod('delete', this);
  }

  public copy(_fileId: DatalabFileId, _destinationDirectoryId: DatalabFileId): Promise<DatalabFile> {
    throw new UnsupportedMethod('copy', this);
  }

  public async getNotebookUrl(_fileId: DatalabFileId): Promise<string> {
    throw new UnsupportedMethod('getNotebookUrl', this);
  }

  public getEditorUrl(_fileId: DatalabFileId): string {
    throw new UnsupportedMethod('getEditorUrl', this);
  }

  public async pathToFileHierarchy(path: string): Promise<DatalabFile[]> {
    const pathParts = path.split('/').filter((part) => !!part);
    if (pathParts.length === 0) {
      return [];
    }
    if (pathParts.length === 1) {
      return [
        this._bqProjectIdToDatalabFile(pathParts[0])
      ];
    }
    if (pathParts.length === 2) {
      return [
        this._bqProjectIdToDatalabFile(pathParts[0]),
        this._bqProjectDatasetIdsToDatalabFile(pathParts[0], pathParts[1]),
      ];
    } else {
      // We log but ignore any path parts past 3
      Utils.log.error(
        'Ignoring bigquery path components after third component:', path);
      return [
        this._bqProjectIdToDatalabFile(pathParts[0]),
        this._bqProjectDatasetIdsToDatalabFile(pathParts[0], pathParts[1]),
        this._bqProjectDatasetTableIdsToDatalabFile(
            pathParts[0], pathParts[1], pathParts[2]),
      ];
    }
  }

  protected myFileManagerType() {
    return FileManagerType.BIG_QUERY;
  }

  protected async _listProjects(): Promise<DatalabFile[]> {
    let resourceProjects = await GapiManager.resourceManager.listAllProjects();
    if (!resourceProjects) {
      return [];
    }
    resourceProjects = resourceProjects.filter((project) => project.projectId);
    if (!resourceProjects) {
      return [];
    }
    // We know we have no blank project IDs here because we filtered them
    // all out above. The or-blank stuff below is to make the compiler happy.
    resourceProjects.sort((a: ResourceManagerProject, b: ResourceManagerProject) => {
      return (a.projectId || '').localeCompare(b.projectId || '');
    });
    return resourceProjects.map((rmProject) =>
        this._bqProjectIdToDatalabFile(rmProject.projectId || ''));
  }

  protected _bqProjectIdToDatalabFile(projectId: string): DatalabFile {
    const path = projectId;
    return new BigQueryFile(
      new DatalabFileId(path, this.myFileManagerType()),
      projectId,
      DatalabFileType.DIRECTORY,
      'datalab-icons:bq-project',
    );
  }

  private async _collectAllDatasets(projectId: string,
                                    accumulatedDatasets: DatasetResource[],
                                    pageToken: string): Promise<DatalabFile[]> {
    const response: HttpResponse<ListDatasetsResponse> =
        await GapiManager.bigquery.listDatasets(projectId, pageToken);
    const additionalDatasets = response.result.datasets || [];
    const datasets = accumulatedDatasets.concat(additionalDatasets);
    if (response.result.nextPageToken) {
      return this._collectAllDatasets(projectId, datasets, response.result.nextPageToken);
    } else {
      datasets.sort((a: DatasetResource, b: DatasetResource) => {
        return a.datasetReference.datasetId.localeCompare(b.datasetReference.datasetId);
      });
      return datasets.map(
          this._bqDatasetToDatalabFile.bind(this)) as DatalabFile[];
    }
  }

  private _listDatasets(projectId: string): Promise<DatalabFile[]> {
    return this._collectAllDatasets(projectId, [], '')
      .catch((e) => { Utils.log.error(e); throw e; });
  }

  private async _collectAllTables(projectId: string, datasetId: string,
                                  accumulatedTables: TableResource[],
                                  pageToken: string): Promise<DatalabFile[]> {
    const response: HttpResponse<ListTablesResponse> =
        await GapiManager.bigquery.listTables(projectId, datasetId, pageToken);
    const additionalTables = response.result.tables || [];
    const tables = accumulatedTables.concat(additionalTables);
    if (response.result.nextPageToken) {
      return this._collectAllTables(projectId, datasetId, tables, response.result.nextPageToken);
    } else {
      tables.sort((a: TableResource, b: TableResource) => {
        return a.tableReference.tableId.localeCompare(b.tableReference.tableId);
      });
      return tables.map(
          this._bqTableToDatalabFile.bind(this)) as DatalabFile[];
    }
  }

  private _listTables(projectId: string, datasetId: string): Promise<DatalabFile[]> {
    return this._collectAllTables(projectId, datasetId, [], '')
      .catch((e) => { Utils.log.error(e); throw e; });
  }

  private _bqRootDatalabFile(): DatalabFile {
    const path = '/';
    return new BigQueryFile(
      new DatalabFileId(path, this.myFileManagerType()),
      '/',
      DatalabFileType.FILE,
      '',
    );
  }

  private _bqDatasetToDatalabFile(bqDataset: DatasetResource): DatalabFile {
    return this._bqProjectDatasetIdsToDatalabFile(
        bqDataset.datasetReference.projectId, bqDataset.datasetReference.datasetId);
  }

  private _bqProjectDatasetIdsToDatalabFile(projectId: string, datasetId: string): DatalabFile {
    const path = projectId + '/' + datasetId;
    return new BigQueryFile(
      new DatalabFileId(path, this.myFileManagerType()),
      datasetId,
      DatalabFileType.DIRECTORY,
      'datalab-icons:bq-dataset',
    );
  }

  private _bqTableToDatalabFile(bqTable: TableResource): DatalabFile {
    const isView = (bqTable.type === 'VIEW');
    return this._bqProjectDatasetTableIdsToDatalabFile(
      bqTable.tableReference.projectId, bqTable.tableReference.datasetId,
      bqTable.tableReference.tableId, isView
    );
  }

  private _bqProjectDatasetTableIdsToDatalabFile(
      projectId: string, datasetId: string, tableId: string, isView?: boolean): DatalabFile {
    const path = projectId + '/' + datasetId + '/' + tableId;
    const icon = isView ? 'datalab-icons:bq-view' : 'datalab-icons:bq-table';
    return new BigQueryFile(
      new DatalabFileId(path, this.myFileManagerType()),
      tableId,
      DatalabFileType.FILE,
      icon,
    );
  }
}

/**
 * A file manager that is just like BigQueryFileManager except that listing the
 * project returns a list of projects such as bigquery-public-data that contain
 * public datasets.
 */
class BigQueryPublicFileManager extends BigQueryFileManager {
  publicProjectNames = [
    'bigquery-public-data',
    'gdelt-bq',
    'lookerdata',
    'nyc-tlc',
  ];

  protected myFileManagerType() {
    return FileManagerType.BIG_QUERY_PUBLIC;
  }

  protected _listProjects(): Promise<DatalabFile[]> {
    const datalabFiles = this.publicProjectNames.map(
        this._bqProjectIdToDatalabFile.bind(this)) as DatalabFile[];
    return Promise.resolve(datalabFiles);
  }
}
