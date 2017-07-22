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

    interface ListTablesResponse {
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

    interface TableResource {
    }
  }
}
