declare namespace gapi.client {
  export module bigquery {
    const datasets: {
      list: (request?: ListDatasetsRequest) => HttpRequest<ListDatasetsResponse>;
    }

    const projects: {
      list: (request?: ListProjectsRequest) => HttpRequest<ListProjectsResponse>;
    }

    const tabledata: {
      list: (request?: ListTabledataRequest) => HttpRequest<ListTabledataResponse>;
    }

    const tables: {
      list: (request?: ListTablesRequest) => HttpRequest<ListTablesResponse>;
      get: (request?: GetTableRequest) => HttpRequest<Table>;
    }

    interface DatasetReference {
      datasetId: string;
      projectId: string;
    }

    interface DatasetResource {
      kind: string;   // Should always be "bigquery#dataset"
      id: string;
      datasetReference: DatasetReference;
      labels: Object;
      friendlyName: string;
    }

    // https://cloud.google.com/bigquery/docs/reference/rest/v2/datasets/list
    interface ListDatasetsRequest {
      projectId: string;
      all?: boolean;    // true to list all datasets, including hidden ones
      filter?: string;  // syntax: "labels.<name>[:<value>]"
            // multiple filters can be ANDed by connecting with a space
      maxResults?: number  // (unsigned int)
      pageToken?: string  // page token as returned by a previous call
    }

    interface ListDatasetsResponse {
      kind: string;   // Should always be "bigquery#datasetList"
      etag: string;
      nextPageToken: string;
      datasets: Array<DatasetResource>;
    }

    // https://cloud.google.com/bigquery/docs/reference/rest/v2/projects/list
    interface ListProjectsRequest {
      maxResults?: number  // (unsigned int)
      pageToken?: string  // page token as returned by a previous call
    }

    interface ListProjectsResponse {
      kind: string;   // Should always be "bigquery#projectList"
      etag: string;
      nextPageToken: string;
      projects: Array<ProjectResource>;
      totalItems: number;
    }

    interface ListTabledataRequest {
      datasetId: string;
      maxResults?: number;  // unsigned integer
      pageToken?: string;
      projectId: string;
      selectedFields?: string;  // comma-separated
      startIndex?: number;  // zero-based unsigned long
      tableId: string;
    }

    interface ListTablesRequest {
      projectId: string;
    }

    interface GetTableRequest {
      datasetId: string;
      projectId: string;
      tableId: string;
    }

    interface TabledataRowColumn {
      v: any;
    }

    interface TabledataRow {
      f: TabledataRowColumn[];
    }

    interface ListTabledataResponse {
      kind: string;   // Should always be "bigquery#tableDataList"
      etag: string;
      pageToken: string;
      rows: TabledataRow[];
      totalRows: number;  // total number of rows in the table (long)
    }

    interface ListTablesResponse {
      kind: string;   // Should always be "bigquery#tableList"
      etag: string;
      nextPageToken: string;
      tables: Array<TableResource>;
    }

    interface Field {
      description?: string;
      fields?: Field[];
      mode?: string;
      name: string;
      type: string;
    }

    interface Table {
      creationTime: string;
      description?: string;
      etag: string;
      id: string;
      kind: string;   // Should always be "bigquery#tableList"
      labels: [{
        name: string;
        value: string;
      }];
      lastModifiedTime: string;
      location: string;
      numBytes: string;
      numLongTermBytes: string;
      numRows: string;
      schema: {
        fields: Field[];
      };
      selfLink: string;
      tableReference: {
        projectId: string;
        datasetId: string;
        tableId: string;
      }
      type: string;
    }

    interface ProjectReference {
      projectId: string;
    }

    interface ProjectResource {
      kind: string;   // Should always be "biqquery#project"
      id: string;
      numericId: number;    // unsigned long
      projectReference: ProjectReference;
      friendlyName: string;
    }

    interface TableReference {
      datasetId: string;
      projectId: string;
      tableId: string;
    }

    interface TableResource {
      kind: string;   // Should always be "bigquery#table"
      id: string;
      tableReference: TableReference;
      type: string;   // "TABLE"
    }
  }
}
