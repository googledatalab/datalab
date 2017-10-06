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

// Parameter placeholders are of the form #${foo} for key foo, which will be
// replaced by the value of foo passed in to the NotebookTemplate constructor.
// Placeholders in the template which are not specified in the parameters
// passed to the NotebookTemplate will remain as-is in the output.
// Parameters passed in to the NotebookTemplate for which there are no
// corresponding placeholders in the template are silently ignored.
const PLACEHOLDER_PREFIX = '#${';
const PLACEHOLDER_POSTFIX = '}';

interface TemplateParameter {
  name: string;
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

  // Element to use to resolve a URL to load the template
  resolver: Polymer.Element;

  constructor(fileId: DatalabFileId, parameters: TemplateParameter[],
      resolver: Polymer.Element) {
    this.fileId = fileId;
    this.parameters = parameters;
    this.resolver = resolver;
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
   * @returns the number of cells that were modified
   */
  public populatePlaceholders(notebook: NotebookContent) {
    let cellChangeCount = 0;
    notebook.cells.forEach((cell: NotebookCell) => {
      // TODO(jimmc) - is there a better way to handle this?
      // When reading from Jupyter, it joins all the source strings before
      // sending us the file, but when reading through our api we get the
      // raw text file in which the source is an array of strings.
      if ((cell.source as any) instanceof Array) {
        cell.source = ((cell.source as any) as Array<string>).join('');
      }
      const oldCellSource = cell.source;
      this.parameters.forEach((parameter: TemplateParameter) => {
        const placeholder =
            PLACEHOLDER_PREFIX + parameter.name + PLACEHOLDER_POSTFIX;
        const escapedPlaceholder = NotebookTemplate._regexEscapeAll(placeholder);
        const regex = new RegExp(escapedPlaceholder);
        const value = (parameter.value || '').toString();
        cell.source = cell.source.replace(regex, value);
      });
      if (cell.source !== oldCellSource) {
        cellChangeCount ++;
      }
    });
    return cellChangeCount;
  }

  /**
   * Inserts a new cell at position zero that defines python variables
   * for all of the parameters.
   */
  public addParameterCell(notebook: NotebookContent) {
    const definitionLines = this.parameters.map(parameter =>
        parameter.name + ' = ' + JSON.stringify(parameter.value));
    const header = '# Auto-generated parameter definitions';
    const cellText = header + '\n' + definitionLines.join('\n');
    const newCell: NotebookCell = {
      cell_type: 'code',
      execution_count: 0,
      metadata: {},
      outputs: [] as string[],
      source: cellText,
    } as NotebookCell;
    notebook.cells.unshift(newCell);  // insert new cell as the first cell
  }
}

/**
 * This template contains one cell that shows the given table's schema.
 */
class BigQueryTableOverviewTemplate extends NotebookTemplate {
  constructor(dict: { [key: string]: any }, resolver: Polymer.Element) {
    const parameters = [];
    for (const k in dict) {
      parameters.push({
        name: k,
        value: dict[k],
      });
    }

    // Specify the default location of the template.
    const defaultTemplateLocation = 'static/templates/BigQueryTableOverview.ipynb';

    // TODO(jimmc); Until we have a user setting, allow specifying an alternate
    // location for the template file, for debugging, such as
    // 'jupyter:datalab/templates/BigQueryTableOverview.ipynb';
    const windowDatalab = window.datalab || {}
    const templateLocation =
        windowDatalab.tableSchemaTemplateFileId || defaultTemplateLocation;
    const templateId = DatalabFileId.fromString(templateLocation);
    super(templateId, parameters, resolver);
  }
}

/**
 * Manages notebook templates, which are notebooks that reference parameter
 * with specific names. This class can also generate a notebook out of any such
 * template. New templates can be created by extending the NotebookTemplate
 * class, and adding a file on disk with appropriate references.
 * TODO: Consider adding an isTemplateAvailable method that checks the
 * existence of a given template on disk and ensures it has the right
 * parameters.
 */
class TemplateManager extends Polymer.Element {

  public static async newNotebookFromTemplate(template: NotebookTemplate) {

    const appSettings = await SettingsManager.getAppSettingsAsync();

    // TODO(jimmc): Look for a user preference for baseDir
    const baseType = (appSettings.defaultFileManager || 'drive');
    const baseDir = baseType + '/';
    // TODO(jimmc): Allow specifying a path with baseDir. For now, we are
    // just using the root of the filesystem as the default location.
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
    const instanceFileManager = FileManagerFactory.getInstanceForType(
      FileManagerFactory.fileManagerNameToType(baseType));

    const closeResult =
        await Utils.showDialog(DirectoryPickerDialogElement, options) as
            DirectoryPickerDialogCloseResult;

    if (closeResult.confirmed && closeResult.fileName) {
      const templateStringContent =
          await this.getTemplateStringContent(template.fileId, template.resolver);
      let templateNotebookContent: NotebookContent;
      try {
        templateNotebookContent = NotebookContent.fromString(templateStringContent);
      } catch (e) {
        throw new Error('Template file is not a notebook.');
      }
      if (template.populatePlaceholders(templateNotebookContent) == 0) {
        // If we found no placeholders, assume we are using parameters instead
        // and add an initial cell with our parameter definitions.
        template.addParameterCell(templateNotebookContent);
      }

      let instanceName = closeResult.fileName;
      if (!instanceName.endsWith('.ipynb')) {
        instanceName += '.ipynb';
      }

      const newFile = await
          instanceFileManager.create(DatalabFileType.NOTEBOOK, closeResult.selectedDirectory.id,
              instanceName);
      return instanceFileManager.saveText(newFile, JSON.stringify(templateNotebookContent));
    } else {
      return null;
    }
  }

  public static async getTemplateStringContent(fileId: DatalabFileId,
      resolver: Polymer.Element) {
    if (fileId.source === FileManagerType.STATIC) {
      const resolvedUrl = resolver.resolveUrl('../..' + fileId.path);
      const templateStringContent =
          await ApiManager.sendTextRequestAsync(resolvedUrl, {}, false);
      return templateStringContent;
    } else {
      const templateFileManager = FileManagerFactory.getInstanceForType(fileId.source);
      const templateStringContent = await templateFileManager.getStringContent(fileId);
      return templateStringContent;
    }
  }
}
