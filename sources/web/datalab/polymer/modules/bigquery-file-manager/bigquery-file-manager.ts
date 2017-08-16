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

class BigQueryMethodNotYetImplemented extends Error {
  constructor(apiFunctionName: string) {
    super('BigQuery method ' + apiFunctionName + ' is not implemented');
  }
}

class BigQueryFile extends DatalabFile {
}

class BigQueryFileId extends DatalabFileId {
  path: string;
}

/**
 * A file manager that wraps the BigQuery API so that we can browse BQ projects,
 * datasets, and tables like a filesystem.
 */
class BigQueryFileManager implements FileManager {

  public get(_fileId: DatalabFileId): Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('get');
  }

  public getContent(_fileId: DatalabFileId, _asText?: boolean): Promise<DatalabFileContent> {
    throw new BigQueryMethodNotYetImplemented('getContent');
  }

  public async getRootFile() {
    return this.get(new DatalabFileId('/', FileManagerType.BIG_QUERY));
  }

  public saveText(_file: DatalabFile, _content: string): Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('save');
  }

  public list(containerId: BigQueryFileId): Promise<DatalabFile[]> {
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
    throw new BigQueryMethodNotYetImplemented('listing datasets');
  }

  public create(_fileType: DatalabFileType, _containerId: DatalabFileId, _name: string):
      Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('create');
  }

  public rename(_oldFileId: DatalabFileId, _name: string, _newContainerId?: DatalabFileId):
      Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('rename');
  }

  public delete(_fileId: DatalabFileId): Promise<boolean> {
    throw new BigQueryMethodNotYetImplemented('delete');
  }

  public copy(_fileId: DatalabFileId, _destinationDirectoryId: DatalabFileId): Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('copy');
  }

  public getNotebookUrl(_fileId: DatalabFileId): Promise<string> {
    throw new BigQueryMethodNotYetImplemented('getNotebookUrl');
  }

  public getEditorUrl(_fileId: DatalabFileId): Promise<string> {
    throw new BigQueryMethodNotYetImplemented('getEditorUrl');
  }

  private _listProjects(): Promise<DatalabFile[]> {
    return GapiManager.listBigQueryProjects()
      .then((response: HttpResponse<gapi.client.bigquery.ListProjectsResponse>) => {
        const projects = response.result.projects || [];
        return projects.map(
            this._bqProjectToDatalabFile.bind(this)) as DatalabFile[];
      })
      .catch((e) => { console.error(e); throw e; });
  }

  private _listDatasets(projectId: string): Promise<DatalabFile[]> {
    return GapiManager.listBigQueryDatasets(projectId, '')
      .then((response: HttpResponse<gapi.client.bigquery.ListDatasetsResponse>) => {
        const datasets = response.result.datasets || [];
        return datasets.map(
            this._bqDatasetToDatalabFile.bind(this)) as DatalabFile[];
      })
      .catch((e) => { console.error(e); throw e; });
  }

  private _listTables(projectId: string, datasetId: string): Promise<DatalabFile[]> {
    return GapiManager.listBigQueryTables(projectId, datasetId)
      .then((response: HttpResponse<gapi.client.bigquery.ListTablesResponse>) => {
        const tables = response.result.tables || [];
        return tables.map(
            this._bqTableToDatalabFile.bind(this)) as DatalabFile[];
      })
      .catch((e) => { console.error(e); throw e; });
  }

  private _bqProjectToDatalabFile(bqProject: gapi.client.bigquery.ProjectResource): DatalabFile {
    const path = bqProject.projectReference.projectId;
    return {
      icon: '',
      id: new DatalabFileId(path, FileManagerType.BIG_QUERY),
      name: bqProject.projectReference.projectId,
      path,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile;
  }

  private _bqDatasetToDatalabFile(bqDataset: gapi.client.bigquery.DatasetResource): DatalabFile {
    const path = bqDataset.datasetReference.projectId + '/' + bqDataset.datasetReference.datasetId;
    return {
      icon: '',
      id: new DatalabFileId(path, FileManagerType.BIG_QUERY),
      name: bqDataset.datasetReference.datasetId,
      path,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile;
  }

  private _bqTableToDatalabFile(bqTable: gapi.client.bigquery.TableResource): DatalabFile {
    const path = bqTable.tableReference.projectId + '/' +
          bqTable.tableReference.datasetId + '/' + bqTable.tableReference.tableId;
    return {
      icon: '',
      id: new DatalabFileId(path, FileManagerType.BIG_QUERY),
      name: bqTable.tableReference.tableId,
      path,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.FILE,
    } as DatalabFile;
  }
}
