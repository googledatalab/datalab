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

  static cookies: { [key: string]: string };

  public static log = class {
    // To enable verbose messages, set the cookie DATALAB_LOG_LEVEL=verbose
    // in your browser console by using the following command while viewing
    // any page in the domain for which you want to enable debug logging:
    //   document.cookie='DATALAB_LOG_LEVEL=verbose; path=/'
    public static verbose(...args: any[]) {
      const logLevel = Utils.readCookie('DATALAB_LOG_LEVEL');
      if (logLevel === 'verbose') {
        // tslint:disable-next-line:no-console
        console.log(...args);
      }
    }

    public static error(...args: any[]) {
      // tslint:disable-next-line:no-console
      console.error(...args);
    }
  };

  public static constants = {
    directory: 'folder',
    editorUrlComponent:   '/editor/',
    file: 'file',
    me: 'me',
    newNotebookUrlComponent:  '/notebook/new/',
    notebook: 'notebook',
    notebookUrlComponent: '/notebook/',

    // Feature names
    // tslint:disable-next-line:object-literal-sort-keys
    features: {
      timeout: 'timeout',
      userSettings: 'userSettings',
    },

    // File browser column names
    columns: {
      dataset: 'Dataset',
      lastModified: 'Last Modified',
      name: 'Name',
      owner: 'Owner',
      project: 'Project',
      table: 'Table',
    }
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
                                 dialogOptions: BaseDialogOptions)
                                 : Promise<BaseDialogCloseResult> {
    // First, make sure another dialog of the same type isn't shown. If it is,
    // cancel this one.
    const dialogs = document.querySelectorAll(dialogType.is) as NodeListOf<BaseDialogElement>;
    if (dialogs.length) {
      return {
        confirmed: false,
      };
    }

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
   * @param message error message
   */
  public static async showErrorDialog(title: string, message: string) {
    const dialogOptions: BaseDialogOptions = {
      isError: true,
      message,
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

  public static getFileTypeString(type: DatalabFileType) {
    switch (type) {
      case DatalabFileType.DIRECTORY:
        return this.constants.directory;
      case DatalabFileType.FILE:
        return this.constants.file;
      case DatalabFileType.NOTEBOOK:
        return this.constants.notebook;
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
   * Returns the value for the named cookie.
   * @param name Name of the cookie to read
   * @param reload If true, reload the cookie cache
   */
  public static readCookie(name: string, reload?: boolean) {
    if (reload || !Utils.cookies) {
      Utils.parseCookies();
    }
    return Utils.cookies[name];
  }

  /**
   * Deletes the named cookie.
   * This assumes the cookie path is set to "/", which is how we are setting our
   * Datalab auth cookies.
   */
  public static deleteCookie(name: string) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT';
    delete Utils.cookies[name];
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
          const flat = {...f} as any;
          flat.name = field.name + '.' + f.name;
          flatFields.push(flat);
        });
      }
    });
    return flatFields;
  }

  /**
   * Reads document.cookie, splits it up, populates Utils.cookies.
   */
  private static parseCookies() {
    const cookieList = document.cookie.split('; ');
    Utils.cookies = {};
    cookieList.forEach((cookie) => {
      const cookieNameValue = cookie.split('=');
      Utils.cookies[cookieNameValue[0]] = cookieNameValue[1];
    });
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
