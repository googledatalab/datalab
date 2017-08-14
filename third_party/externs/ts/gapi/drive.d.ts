declare namespace gapi.client {
  export module drive {

    // https://developers.google.com/drive/v3/reference/files/list
    interface ListFilesRequest {
      fields?: string;
      orderBy?: string;
      pageSize?: number;
      pageToken?: string;
      q?: string; // Search/filter query
    }

    // https://developers.google.com/drive/v3/reference/files#resource
    interface File {
      createdTime: Date;
      description: string;
      id: string;
      kind: string; // 'drive#file'
      mimeType: string;
      modifiedTime: Date;
      name: string;
      parents: string[];
      starred: boolean;
      trashed: boolean;
    }

    interface ListFilesResponse {
      files: File[];
      incompleteSearch: boolean;
      kind: string;   // Should always be "drive#fileList"
      nextPageToken: string;
    }

    const files: {
      list: (request?: ListFilesRequest) => Promise<HttpResponse<ListFilesResponse>>;
    }
  }
}
