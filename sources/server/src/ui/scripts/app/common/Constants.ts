/*
 * Copyright 2014 Google Inc. All rights reserved.
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


/**
 * App-wide constants.
 */


/**
 * Path to the root of the Angular app.
 */
export var scriptPaths = {
  app: 'scripts/app'
};

/**
 * The (Angular) module name for the app.
 */
export var appModuleName = 'app';

export var layouts = {
  sidebar: {
    directiveName: 'sidebarLayout'
  }
};

// Angular directive names.
//
// Note: When using these directive names within templates, the names are expected to be in
// snake-case; e.g., directiveName:"fooBarBaz" is referred to as <foo-bar-baz /> within
// an Angular template.
export var cellToolbar = {
  directiveName: 'datalabCellToolbar'
};
export var codeEditor = {
  directiveName: 'datalabCodeEditor'
};
export var editorCell = {
  directiveName: 'datalabEditorCell'
};
export var headingViewer = {
  directiveName: 'datalabHeadingViewer'
};
export var markdownViewer = {
  directiveName: 'datalabMarkdownViewer'
};
export var notebookTitle = {
  directiveName: 'datalabNotebookTitle'
};
export var notebookToolbar = {
  directiveName: 'datalabNotebookToolbar'
};

// Generic angular component names used for dependency injection (e.g., services, factories,
// providers, etc.).
export var clientNotebookSession = {
  name: 'clientNotebookSession'
};
export var sessionConnection = {
  name: 'sessionConnection'
};
export var sessionEventDispatcher = {
  name: 'sessionEventDispatcher'
};


// Route-specific angular component names.
export var notebooks = {
  pageControllerName: 'NotebooksPageController',
  edit: {
    pageControllerName: 'EditPageController'
  }
};

// Logging scope names.
export var scopes = {
  // Cell directives.
  editorCell: 'editorCell',

  // Generic directives.
  cellToolbar: 'cellToolbar',
  codeEditor: 'codeEditor',
  layouts: 'layouts',
  headingViewer: 'headingViewer',
  markdownViewer: 'markdownViewer',
  notebookTitle: 'notebookTitle',
  notebookToolbar: 'notebookToolbar',

  // Route-specific components.
  notebooks: {
    page: 'notebooks.page',
    edit: {
      page: 'notebooks.edit.page'
    }
  },

  // Other injectables (services, factories, providers, etc.).
  clientNotebookSession: clientNotebookSession.name,
  sessionConnection: sessionConnection.name,
  sessionEventDispatcher: sessionEventDispatcher.name,
};
