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

class BigQueryFile extends DatalabFile {
  public getPreviewName(): string {
    if (this.type == DatalabFileType.FILE) {
      return 'table';
    }
    return '';
  }
}

/**
 * A file manager that wraps the BigQuery API so that we can browse BQ projects,
 * datasets, and tables like a filesystem.
 */
class BigQueryFileManager implements FileManager {

  public get(fileId: DatalabFileId): Promise<DatalabFile> {
    if (fileId.path === '/') {
      return Promise.resolve(this._bqRootDatalabFile());
    }
    throw new UnsupportedMethod('get', this);
  }

  public getContent(_fileId: DatalabFileId, _asText?: boolean): Promise<DatalabContent> {
    throw new UnsupportedMethod('getContent', this);
  }

  public async getRootFile() {
    return this.get(new DatalabFileId('/', FileManagerType.BIG_QUERY));
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
    throw new UnsupportedMethod('listing datasets', this);
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

  public getNotebookUrl(_fileId: DatalabFileId): Promise<string> {
    throw new UnsupportedMethod('getNotebookUrl', this);
  }

  public getEditorUrl(_fileId: DatalabFileId): Promise<string> {
    throw new UnsupportedMethod('getEditorUrl', this);
  }

  private _listProjects(): Promise<DatalabFile[]> {
    return GapiManager.bigquery.listProjects()
      .then((response: HttpResponse<gapi.client.bigquery.ListProjectsResponse>) => {
        const projects = response.result.projects || [];
        return projects.map(
            this._bqProjectToDatalabFile.bind(this)) as DatalabFile[];
      })
      .catch((e) => { Utils.log.error(e); throw e; });
  }

  private _listDatasets(projectId: string): Promise<DatalabFile[]> {
    return GapiManager.bigquery.listDatasets(projectId, '')
      .then((response: HttpResponse<gapi.client.bigquery.ListDatasetsResponse>) => {
        const datasets = response.result.datasets || [];
        return datasets.map(
            this._bqDatasetToDatalabFile.bind(this)) as DatalabFile[];
      })
      .catch((e) => { Utils.log.error(e); throw e; });
  }

  private _listTables(projectId: string, datasetId: string): Promise<DatalabFile[]> {
    return GapiManager.bigquery.listTables(projectId, datasetId)
      .then((response: HttpResponse<gapi.client.bigquery.ListTablesResponse>) => {
        const tables = response.result.tables || [];
        return tables.map(
            this._bqTableToDatalabFile.bind(this)) as DatalabFile[];
      })
      .catch((e) => { Utils.log.error(e); throw e; });
  }

  private _bqRootDatalabFile(): DatalabFile {
    const path = '/';
    return new BigQueryFile({
      icon: '',
      id: new DatalabFileId(path, FileManagerType.BIG_QUERY),
      name: '/',
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.FILE,
    } as DatalabFile);
  }

  private _bqProjectToDatalabFile(bqProject: gapi.client.bigquery.ProjectResource): DatalabFile {
    const path = bqProject.projectReference.projectId;
    return new BigQueryFile({
      icon: 'datalab-icons:bq-project',
      id: new DatalabFileId(path, FileManagerType.BIG_QUERY),
      name: bqProject.projectReference.projectId,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile);
  }

  private _bqDatasetToDatalabFile(bqDataset: gapi.client.bigquery.DatasetResource): DatalabFile {
    const path = bqDataset.datasetReference.projectId + '/' + bqDataset.datasetReference.datasetId;
    return new BigQueryFile({
      icon: 'folder',   // TODO(jimmc) - make a custom icon
      id: new DatalabFileId(path, FileManagerType.BIG_QUERY),
      name: bqDataset.datasetReference.datasetId,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile);
  }

  private _bqTableToDatalabFile(bqTable: gapi.client.bigquery.TableResource): DatalabFile {
    const path = bqTable.tableReference.projectId + '/' +
          bqTable.tableReference.datasetId + '/' + bqTable.tableReference.tableId;
    return new BigQueryFile({
      icon: 'list',   // TODO(jimmc) - make a custom icon
      id: new DatalabFileId(path, FileManagerType.BIG_QUERY),
      name: bqTable.tableReference.tableId,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.FILE,
    } as DatalabFile);
  }
}
