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

/**
 * A file manager that wraps the BigQuery API so that we can browse BQ projects,
 * datasets, and tables like a filesystem.
 */
class BigQueryFileManager implements FileManager {

  /**
   * Returns a DatalabFile object representing the file or directory requested
   * @param path string path to requested file
   * @param asText whether the file should be downloaded as plain text. This is
   *               useful for downloading notebooks, which are by default read
   *               as JSON, which doesn't preserve formatting.
   */
  public async get(path: string, asText?: boolean): Promise<DatalabFile> {
    path; asText; // Make compiler happy until we implement this function.
    throw new BigQueryMethodNotYetImplemented('get');
  }

  /**
   * Uploads the given file object to the backend. The file's name, path, format,
   * and content are required fields.
   * @param model object containing file information to send to backend
   */
  public async save(file: DatalabFile): Promise<DatalabFile> {
    file; // Make compiler happy until we implement this function.
    throw new BigQueryMethodNotYetImplemented('save');
  }

  /**
   * Returns a list of files at the target path, each implementing the
   * DatalabFile interface. Two requests are made to /api/contents and
   * /api/sessions to get this data.
   * @param path current path to list files under
   */
  public list(path: string): Promise<DatalabFile[]> {
    const pathParts = path.split('/').filter((part) => !!part);
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

  /**
   * Creates a new notebook or directory.
   * @param itemType type of the created item, can be 'notebook' or 'directory'
   */
  public create(itemType: DatalabFileType, path?: string): Promise<DatalabFile> {
    itemType; path; // Make compiler happy until we implement this function.
    throw new BigQueryMethodNotYetImplemented('create');
  }

  /**
   * Renames an item
   * @param oldPath source path of the existing item
   * @param newPath destination path of the renamed item
   */
  public rename(oldPath: string, newPath: string): Promise<DatalabFile> {
    oldPath; newPath; // Make compiler happy until we implement this function.
    throw new BigQueryMethodNotYetImplemented('rename');
  }

  /**
   * Deletes an item
   * @param path item path to delete
   */
  public delete(path: string): Promise<boolean> {
    path; // Make compiler happy until we implement this function.
    throw new BigQueryMethodNotYetImplemented('delete');
  }

  /*
   * Copies an item from source to destination. Item name collisions at the destination
   * are handled by BigQuery.
   * @param path path to copied item
   * @param destinationDirectory directory to copy the item into
   */
  public copy(path: string, destinationDirectory: string): Promise<DatalabFile> {
    path; destinationDirectory; // Make compiler happy until we implement this function.
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
  };

  private _bqDatasetToDatalabFile(bqDataset: gapi.client.bigquery.DatasetResource): DatalabFile {
    return {
      name: bqDataset.datasetReference.datasetId,
      path: bqDataset.datasetReference.projectId + '/' + bqDataset.datasetReference.datasetId,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.DIRECTORY,
    } as DatalabFile;
  };

  private _bqTableToDatalabFile(bqTable: gapi.client.bigquery.TableResource): DatalabFile {
    return {
      name: bqTable.tableReference.tableId,
      path: bqTable.tableReference.projectId + '/' +
          bqTable.tableReference.datasetId + '/' + bqTable.tableReference.tableId,
      status: DatalabFileStatus.IDLE,
      type: DatalabFileType.FILE,
    } as DatalabFile;
  };
}
