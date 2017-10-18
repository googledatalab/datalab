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

/**
 * Class provides helper methods for various operations.
 */
class Utils {

  public static log = class {
    public static verbose(...args: any[]) {
      // tslint:disable-next-line:no-console
      console.log(...args);
    }
    public static error(...args: any[]) {
      // tslint:disable-next-line:no-console
      console.error(...args);
    }
  };

  public static constants = {
    editorUrlComponent:   '/editor/',
    newNotebookUrlComponent:  '/notebook/new/',
    notebookUrlComponent: '/notebook/',

    // Feature names
    timeoutFeature:       'timeout',
  };

  /**
   * Resolves the given URL using the datalab-app element's base URI. This
   * obviously requires the element to exist on the calling document. If we
   * move away from requiring a datalab-app element on each entrypoint page,
   * we will need some other common element here.
   */
  public static resolveUrlToDatalabApp(url: string) {
    const mod = Polymer.DomModule.import('datalab-app', '');
    return Polymer.ResolveUrl.resolveUrl(url, mod.assetpath);
  }

  /**
   * Opens a dialog with the specified options. It uses the Datalab custom element
   * according to the specified dialog type, attaches a new instance to the current
   * document, opens it, and returns a promise that resolves when the dialog is closed.
   * If you are using a dialog that needs to know its size in order to render,
   * make sure you include an event listener on iron-overlay-opened in the
   * dialog so that it can render itself properly once it becomes visible.
   * @param type specifies which type of dialog to use
   * @param dialogOptions specifies different options for opening the dialog
   */
  public static async showDialog(dialogType: typeof BaseDialogElement,
                                 dialogOptions: BaseDialogOptions) {
    const dialog = document.createElement(dialogType.is) as any;
    document.body.appendChild(dialog);

    if (dialog.readyPromise) {
      // Wait for the element to finish its initialization before we set
      // property values on it so that we don't have two threads running
      // at the same time fiddling with properties.
      await dialog.readyPromise;
    }

    // Copy the dialog options fields into the dialog element
    Object.keys(dialogOptions).forEach((key) => {
      dialog[key] = (dialogOptions as any)[key];
    });

    // Open the dialog
    const closeResult = await dialog.openAndWait();
    document.body.removeChild(dialog);
    return closeResult;
  }

  /**
   * Shows a base dialog with error formatting.
   * @param title error title
   * @param messageHtml error message
   */
  public static async showErrorDialog(title: string, messageHtml: string) {
    const dialogOptions: BaseDialogOptions = {
      isError: true,
      messageHtml,
      okLabel: 'Close',
      title,
    };

    return this.showDialog(BaseDialogElement, dialogOptions);
  }

  /**
   * Utility function that helps with the Polymer inheritance mechanism. It takes the subclass,
   * the superclass, and an element selector. It loads the templates for the two classes,
   * and inserts all of the elements from the subclass into the superclass's template, under
   * the element specified with the CSS selector, then returns the merged template.
   *
   * This allows for a very flexible expansion of the superclass's HTML template, so that we're
   * not limited by wrapping the extended element, but we can actually inject extra elements
   * into its template, all while extending all of its javascript and styles.
   * @param subType class that is extending a superclass
   * @param baseType the superclass being extended
   * @param baseRootElementSelector a selector for an element that will be root
   *                                for the stamped template
   */
  public static stampInBaseTemplate(subType: string, baseType: string,
                                    baseRootElementSelector: string) {
    // Start with the base class's template
    const basetypeTemplate = Polymer.DomModule.import(baseType, 'template');
    const subtypeTemplate = Polymer.DomModule.import(subType, 'template');
    // Clone the base template; we don't want to change it in-place
    const stampedTemplate = basetypeTemplate.cloneNode(true) as PolymerTemplate;

    // Insert this template's elements in the base class's #body
    const bodyElement = stampedTemplate.content.querySelector(baseRootElementSelector);
    if (bodyElement) {
      while (subtypeTemplate.content.children.length) {
        const childNode = subtypeTemplate.content.firstElementChild as HTMLElement;
        bodyElement.insertAdjacentElement('beforeend', childNode);
      }
    }

    return stampedTemplate;
  }

  /**
   * Deletes all child elements of an element.
   */
  public static deleteAllChildren(parent: HTMLElement) {
    while (parent.firstChild) {
      parent.removeChild(parent.firstChild);
    }
  }

  /**
   * Moves all child elements from one element to another.
   * @param from element whose children to move
   * @param to destination elements where children will be moved to
   */
  public static moveElementChildren(from: HTMLElement, to: HTMLElement) {
    while (from.firstChild) {
      to.appendChild(from.firstChild);
    }
  }

  /**
   * Given a string type for an item, return the name of the icon to use.
   */
  public static getItemIconString(type: DatalabFileType) {
    return type === DatalabFileType.DIRECTORY ? 'folder' : 'editor:insert-drive-file';
  }

  // TODO: Consider moving to a dedicated strings module
  public static getFileTypeString(type: DatalabFileType) {
    switch (type) {
      case DatalabFileType.DIRECTORY:
        return 'directory';
      case DatalabFileType.FILE:
        return 'file';
      case DatalabFileType.NOTEBOOK:
        return 'notebook';
      default:
        throw new Error('Unknown file type: ' + type);
    }
  }

  /**
   * Returns the current root URI.
   */
  public static getHostRoot() {
    return location.protocol + '//' + location.host;
  }

  /**
   * Flattens a BigQuery table schema
   */
  public static flattenFields(fields: gapi.client.bigquery.Field[]) {
    const flatFields: gapi.client.bigquery.Field[] = [];
    fields.forEach((field) => {

      // First push the record field itself
      flatFields.push(field);

      // Then flatten it and push its children
      if (field.type === 'RECORD' && field.fields) {
        // Make sure we copy the flattened nested fields before modifying their
        // name to prepend the parent field name. This way the original name in
        // the schema object does not change.
        const nestedFields = [...Utils.flattenFields(field.fields)];
        nestedFields.forEach((f) => {
          const flat = {...f};
          flat.name = field.name + '.' + f.name;
          flatFields.push(flat);
        });
      }
    });
    return flatFields;
  }
}

class UnsupportedMethod extends Error {
  constructor(methodName: string, object: {}) {
    let type = 'Unknown';
    if (object && object.constructor && object.constructor.name) {
      type = object.constructor.name;
    }
    super('Method ' + methodName + ' is not supported on type ' + type);
  }
}
