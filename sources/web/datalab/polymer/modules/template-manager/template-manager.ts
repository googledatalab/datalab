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

enum TEMPLATE_NAME {
  bigqueryOverview = 'bigqueryOverview',
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
        cell.source = ((cell.source as any) as string[]).join('');
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
    const definitionLines = this.parameters.map((parameter) =>
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
  constructor(dict: { [key: string]: any }) {
    const parameters = Object.keys(dict).map((k) => ({name: k, value: dict[k]}));

    // Specify the default location of the template.
    const defaultTemplateLocation = 'static/templates/BigQueryTableOverview.ipynb';

    // TODO(jimmc); Until we have a user setting, allow specifying an alternate
    // location for the template file, for debugging, such as
    // 'jupyter:datalab/templates/BigQueryTableOverview.ipynb';
    const windowDatalab = window.datalab || {};
    const templateLocation =
        windowDatalab.tableSchemaTemplateFileId || defaultTemplateLocation;
    const templateId = DatalabFileId.fromString(templateLocation);
    super(templateId, parameters);
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

  public static async newNotebookFromTemplate(name: string, params: {}) {
    let templateClassName: new ({}) => NotebookTemplate;
    switch (name) {
      case TEMPLATE_NAME.bigqueryOverview:
        templateClassName = BigQueryTableOverviewTemplate; break;
      default:
        throw new Error('Unknown template name: ' + name);
    }
    const template = new templateClassName(params);

    const templateStringContent = await this.getTemplateStringContent(template.fileId);
    let templateNotebookContent: NotebookContent;
    try {
      templateNotebookContent = NotebookContent.fromString(templateStringContent);
    } catch (e) {
      throw new Error('Template file is not a notebook.');
    }
    if (template.populatePlaceholders(templateNotebookContent) === 0) {
      // If we found no placeholders, assume we are using parameters instead
      // and add an initial cell with our parameter definitions.
      template.addParameterCell(templateNotebookContent);
    }
    return templateNotebookContent;
  }

  public static async getTemplateStringContent(fileId: DatalabFileId) {
    if (fileId.source === FileManagerType.STATIC) {
      const resolvedUrl = Utils.resolveUrlToDatalabApp('../../' + fileId.path);
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
