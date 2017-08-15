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

class BigQueryFile {
  path: string;
}

/**
 * A file manager that wraps the BigQuery API so that we can browse BQ projects,
 * datasets, and tables like a filesystem.
 */
class BigQueryFileManager implements FileManager {

  public get(_file: DatalabFile, _asText?: boolean): Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('get');
  }

  public save(_file: DatalabFile): Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('save');
  }

  public list(container: DatalabFile): Promise<DatalabFile[]> {
    const bqContainer = this._castDatalabFileToBigQueryFile(container);
    // BigQuery does not allow slashes in the names of projects,
    // datasets, or tables, so we use them as separator characters
    // to keep consistent with POSIX file hierarchies.
    // We also filter out blank entries, which "collapses" consecutive
    // slashes. It also means both '' and '/' turn into an empty
    // array of pathParts and are thus interpreted as the root.
    const pathParts = bqContainer.path.split('/').filter((part) => !!part);
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

  public create(_fileType: DatalabFileType, _container: DatalabFile, _name: string):
      Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('create');
  }

  public rename(_oldFile: DatalabFile, _name: string, _newContainer?: DatalabFile):
      Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('rename');
  }

  public delete(_file: DatalabFile): Promise<boolean> {
    throw new BigQueryMethodNotYetImplemented('delete');
  }

  public copy(_file: DatalabFile, _destinationDirectory: DatalabFile): Promise<DatalabFile> {
    throw new BigQueryMethodNotYetImplemented('copy');
  }

  private _listProjects(): Promise<DatalabFile[]> {
    return GapiManager.listBigQueryProjects()
      .then((response: HttpResponse<gapi.client.bigquery.ListProjectsResponse>) => {
        const projects = response.result.projects || [];
        return projects.map(
            this._bqProjectToDatalabFile.bind(this)) as DatalabFile[];
      })
      .catch((e) => { console.error(e); throw e;});
  }

  private _listDatasets(projectId: string): Promise<DatalabFile[]> {
    return GapiManager.listBigQueryDatasets(projectId, '')
      .then((response: HttpResponse<gapi.client.bigquery.ListDatasetsResponse>) => {
        const datasets = response.result.datasets || [];
        return datasets.map(
            this._bqDatasetToDatalabFile.bind(this)) as DatalabFile[];
      })
      .catch((e) => { console.error(e); throw e;});
  }

  private _listTables(projectId: string, datasetId: string): Promise<DatalabFile[]> {
    return GapiManager.listBigQueryTables(projectId, datasetId)
      .then((response: HttpResponse<gapi.client.bigquery.ListTablesResponse>) => {
        const tables = response.result.tables || [];
        return tables.map(
            this._bqTableToDatalabFile.bind(this)) as DatalabFile[];
      })
      .catch((e) => { console.error(e); throw e;});
  }

  private _bqProjectToDatalabFile(bqProject: gapi.client.bigquery.ProjectResource): DatalabFile {
    return {
      name: bqProject.projectReference.projectId,
      path: bqProject.projectReference.projectId,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile;
  }

  private _bqDatasetToDatalabFile(bqDataset: gapi.client.bigquery.DatasetResource): DatalabFile {
    return {
      name: bqDataset.datasetReference.datasetId,
      path: bqDataset.datasetReference.projectId + '/' + bqDataset.datasetReference.datasetId,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile;
  }

  private _bqTableToDatalabFile(bqTable: gapi.client.bigquery.TableResource): DatalabFile {
    return {
      name: bqTable.tableReference.tableId,
      path: bqTable.tableReference.projectId + '/' +
          bqTable.tableReference.datasetId + '/' + bqTable.tableReference.tableId,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.FILE,
    } as DatalabFile;
  }

  private _castDatalabFileToBigQueryFile(file: DatalabFile): BigQueryFile {
    const bqFile = file as BigQueryFile;
    for (const k in BigQueryFile) {
      if (!(k in bqFile)) {
        throw new Error('Property ' + k + ' not found in file');
      }
    }
    return bqFile;
  }
}
