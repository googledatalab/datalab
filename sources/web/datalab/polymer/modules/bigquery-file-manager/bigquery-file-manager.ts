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

  public getNotebookUrl(_fileId: DatalabFileId): string {
    throw new UnsupportedMethod('getNotebookUrl', this);
  }

  public getEditorUrl(_fileId: DatalabFileId): string {
    throw new UnsupportedMethod('getEditorUrl', this);
  }

  public pathToPathHistory(path: string): DatalabFile[] {
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

  protected _listProjects(): Promise<DatalabFile[]> {
    return this._collectAllProjects([], '')
      .catch((e: Error) => { Utils.log.error(e); throw e; });
  }

  protected _bqProjectIdToDatalabFile(projectId: string): DatalabFile {
    const path = projectId;
    return new BigQueryFile({
      icon: 'datalab-icons:bq-project',
      id: new DatalabFileId(path, this.myFileManagerType()),
      name: projectId,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile);
  }

  private async _collectAllProjects(accumulatedProjects: ProjectResource[],
                                    pageToken: string): Promise<DatalabFile[]> {
    const response: HttpResponse<ListProjectsResponse> =
        await GapiManager.bigquery.listProjects(pageToken);
    const additionalProjects = response.result.projects || [];
    const projects = accumulatedProjects.concat(additionalProjects);
    if (response.result.nextPageToken) {
      return this._collectAllProjects(projects, response.result.nextPageToken);
    } else {
      projects.sort((a: ProjectResource, b: ProjectResource) => {
        return a.projectReference.projectId.localeCompare(b.projectReference.projectId);
      });
      return projects.map(
          this._bqProjectToDatalabFile.bind(this)) as DatalabFile[];
    }
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
    return new BigQueryFile({
      icon: '',
      id: new DatalabFileId(path, this.myFileManagerType()),
      name: '/',
      type: DatalabFileType.FILE,
    } as DatalabFile);
  }

  private _bqProjectToDatalabFile(bqProject: ProjectResource): DatalabFile {
    return this._bqProjectIdToDatalabFile(bqProject.projectReference.projectId);
  }

  private _bqDatasetToDatalabFile(bqDataset: DatasetResource): DatalabFile {
    return this._bqProjectDatasetIdsToDatalabFile(
        bqDataset.datasetReference.projectId, bqDataset.datasetReference.datasetId);
  }

  private _bqProjectDatasetIdsToDatalabFile(projectId: string, datasetId: string): DatalabFile {
    const path = projectId + '/' + datasetId;
    return new BigQueryFile({
      icon: 'datalab-icons:bq-dataset',
      id: new DatalabFileId(path, this.myFileManagerType()),
      name: datasetId,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile);
  }

  private _bqTableToDatalabFile(bqTable: TableResource): DatalabFile {
    return this._bqProjectDatasetTableIdsToDatalabFile(
      bqTable.tableReference.projectId, bqTable.tableReference.datasetId,
      bqTable.tableReference.tableId
    );
  }

  private _bqProjectDatasetTableIdsToDatalabFile(
      projectId: string, datasetId: string, tableId: string): DatalabFile {
    const path = projectId + '/' + datasetId + '/' + tableId;
    return new BigQueryFile({
      icon: 'datalab-icons:bq-table',
      id: new DatalabFileId(path, this.myFileManagerType()),
      name: tableId,
      type: DatalabFileType.FILE,
    } as DatalabFile);
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
