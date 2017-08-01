declare namespace gapi.client {
  export module bigquery {
    const datasets: {
      list: (request?: ListDatasetsRequest) => HttpRequest<ListDatasetsResponse>;
    }

    const projects: {
      list: (request?: ListProjectsRequest) => HttpRequest<ListProjectsResponse>;
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

    interface ListTablesRequest {
      projectId: string;
    }

    interface GetTableRequest {
      datasetId: string;
      projectId: string;
      tableId: string;
    }

    interface ListTablesResponse {
      kind: string;   // Should always be "bigquery#tableList"
      etag: string;
      nextPageToken: string;
      tables: Array<TableResource>;
    }

    interface Table {
      creationTime: string;
      etag: string;
      id: string;
      kind: string;   // Should always be "bigquery#tableList"
      labels: [{
        name: string;
        value: string;
      }]
      lastModifiedTime: string;
      location: string;
      numBytes: string;
      numLongTermBytes: string;
      numRows: string;
      schema: {
        fields: [{
          mode?: string;
          name: string;
          type: string;
        }]
      }
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
