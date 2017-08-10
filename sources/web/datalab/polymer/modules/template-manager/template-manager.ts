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

const PLACEHOLDER_PREFIX = '#$';

interface TemplateParameter {
  placeholder: string;
  value: string | number;
}

/**
 * This models a notebook template, including its path on disk as well as a
 * list of its required parameters.
 */
class NotebookTemplate {
  // Path to the template file on disk
  path: string;

  // List of parameters required by the template
  parameters: TemplateParameter[];

  constructor(path: string, parameters: TemplateParameter[]) {
    this.path = path;
    this.parameters = parameters;
  }

  /**
   * Escapes all regex modifier characters in the given string.
   */
  private static _regexEscapeAll(s: string) {
    return s.replace(/([.*+?^${}()|\[\]\/\\])/g, '\\$1');
  }

  /**
   * Substitutes all placeholders in the given notebook's cells with their
   * values.
   */
  public populatePlaceholders(notebook: Notebook) {

    notebook.cells.forEach((cell: NotebookCell) => {
      this.parameters.forEach((parameter: TemplateParameter) => {
        const placeholder = PLACEHOLDER_PREFIX + parameter.placeholder;
        const escapedPlaceholder = NotebookTemplate._regexEscapeAll(placeholder);
        const regex = new RegExp(escapedPlaceholder);
        const value = '\'' + parameter.value.toString() + '\'';
        cell.source = cell.source.replace(regex, value);
      });
    });

  }
}

/**
 * This template contains one cell that shows the given table's schema.
 */
class TableSchemaTemplate extends NotebookTemplate {
  constructor(tableName: string) {
    const parameters = [{
      placeholder: 'TABLE_NAME_PLACEHOLDER',
      value: tableName,
    }];

    super('tableSchema.ipynb', parameters);
  }
}

/**
 * Manages notebook templates, which are notebooks that contain parameter
 * placeholders. This class can also generate a notebook out of any such
 * template. New templates can be created by extending the NotebookTemplate
 * class, and adding a file on disk with placeholders. All placeholders have to
 * use the same prefix declared in this file.
 * TODO: Consider adding an isTemplateAvailable method that checks the
 * existence of a given template on disk and ensures it has the right
 * placeholders.
 */
class TemplateManager {

  private static _templatePrefix = 'datalab/templates/';

  public static async newNotebookFromTemplate(template: NotebookTemplate) {

    const options: DirectoryPickerDialogOptions = {
      big: true,
      okLabel: 'Save Here',
      title: 'New Notebook',
      withFileName: true,
    };

    const closeResult = await Utils.showDialog(DirectoryPickerDialogElement, options) as
        DirectoryPickerDialogCloseResult;

    if (closeResult.confirmed && closeResult.fileName) {
      const path = TemplateManager._templatePrefix + template.path;
      const file = await FileManagerFactory.getInstance().get(path);

      file.name = closeResult.fileName;
      if (!file.name.endsWith('.ipynb')) {
        file.name += '.ipynb';
      }
      file.path = closeResult.directoryPath;
      template.populatePlaceholders(file.content as Notebook);

      return file;
    } else {
      return null;
    }

  }

}
