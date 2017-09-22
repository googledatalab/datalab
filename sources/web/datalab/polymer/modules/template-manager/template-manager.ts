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
  // File id of the template file
  fileId: DatalabFileId;

  // List of parameters required by the template
  parameters: TemplateParameter[];

  constructor(fileId: DatalabFileId, parameters: TemplateParameter[]) {
    this.fileId = fileId;
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
  public populatePlaceholders(notebook: NotebookContent) {

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

    // TODO: The actual template files should live somewhere more static.
    const templateId = new DatalabFileId('datalab/templates/tableSchema.ipynb',
        FileManagerType.JUPYTER);
    super(templateId, parameters);
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

  public static async newNotebookFromTemplate(template: NotebookTemplate) {

    const appSettings = await SettingsManager.getAppSettingsAsync();

    // TODO(jimmc): Look for a user preference for baseDir
    let baseDir = (appSettings.defaultFileManager || 'drive') + ':';
    // TODO(jimmc): Allow specifying a path with baseDir. For now, we are
    // just using the root of the filesystem as the default location.
    if (baseDir === 'jupyter:') {
      // Jupyter root directory does not persist between container restarts,
      // so we use the datalab dir as the default in this case.
      baseDir = baseDir + 'datalab/';
    }
    const baseName = 'temp';
    // Add some more stuff to the name to make it different each time.
    // We are not checking to see if the file exists, so it is not
    // guaranteed to produce a unique filename, but since we are doing
    // it based on the current time down to the second, and it is scoped
    // only to this user, the odds of a collision are pretty low.
    const dateStr = new Date().toISOString();
    const yearStr =
        dateStr.slice(0,4) + dateStr.slice(5, 7) + dateStr.slice(8, 10);
    const timeStr =
        dateStr.slice(11,13) + dateStr.slice(14, 16) + dateStr.slice(17, 19);
    const moreName = yearStr + '_' + timeStr;
    const fileName = baseName + '_' + moreName + '.ipynb';
    const options: DirectoryPickerDialogOptions = {
      big: true,
      fileId: baseDir,
      fileName,
      okLabel: 'Save Here',
      title: 'New Notebook',
      withFileName: true,
    };

    const closeResult =
        await Utils.showDialog(DirectoryPickerDialogElement, options) as
            DirectoryPickerDialogCloseResult;

    if (closeResult.confirmed && closeResult.fileName) {
      const fileManager = FileManagerFactory.getInstanceForType(template.fileId.source);
      const templateStringContent = await fileManager.getStringContent(template.fileId);
      let templateNotebookContent: NotebookContent;
      try {
        templateNotebookContent = NotebookContent.fromString(templateStringContent);
      } catch (e) {
        throw new Error('Template file is not a notebook.');
      }
      const templateFile = await fileManager.get(template.fileId);

      templateFile.name = closeResult.fileName;
      if (!templateFile.name.endsWith('.ipynb')) {
        templateFile.name += '.ipynb';
      }
      template.populatePlaceholders(templateNotebookContent);

      const newFile = await
          fileManager.create(DatalabFileType.NOTEBOOK, closeResult.selectedDirectory.id,
              templateFile.name);
      return fileManager.saveText(newFile, JSON.stringify(templateNotebookContent));
    } else {
      return null;
    }
  }
}
