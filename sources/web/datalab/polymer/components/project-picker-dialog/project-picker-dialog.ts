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

/// <reference path="../../modules/gapi-manager/gapi-manager.ts" />

/**
 * Dialog close context, includes whether the dialog was confirmed, and the
 * user selected project.
 */
interface ProjectPickerDialogCloseResult extends BaseDialogCloseResult {
  projectId: string;
  projectName: string;
}

/**
 * Project picker element for Datalab. This provides a way to list the user's
 * projects and pick one of them. It also provides a search functionality.
 * TODO: Consider remembering the last few selected projects and showing those
 * first.
 */
class ProjectPickerDialogElement extends BaseDialogElement {

  private static _memoizedTemplate: PolymerTemplate;

  public selectedProjectId: string;
  public selectedProjectName: string;

  private _busy: boolean;

  static get is() { return 'project-picker-dialog'; }

  static get properties() {
    return {
      ...super.properties,
      _busy: Boolean,
      selectedProjectId: {
        type: String,
        value: null,
      },
      selectedProjectName: {
        type: String,
        value: null,
      },
    };
  }

  /**
   * This template is calculated once in run time based on the template of  the
   * super class, then saved in a local variable for memoization.
   * See https://www.polymer-project.org/2.0/docs/devguide/dom-template#inherited-templates
   */
  static get template() {
    if (!this._memoizedTemplate) {
      this._memoizedTemplate = Utils.stampInBaseTemplate(this.is, super.is, '#body');
    }
    return this._memoizedTemplate;
  }

  async ready() {
    super.ready();
    const itemlist = this.$.projectList as ItemListElement;

    this._busy = true;
    try {
      const projects = await GapiManager.resourceManager.listAllProjects();
      const listItems = this._projectsToListItems(projects);
      itemlist.rows = listItems;

      this._busy = false;
    } catch (e) {
      this._busy = false;
      throw e;
    }

    // The dialog will likely need to resize after loading projects
    this.$.theDialog.notifyResize();

    itemlist.addEventListener('itemDoubleClick',
                                  this._handleDoubleClicked.bind(this));
    itemlist.addEventListener('selected-indices-changed',
                                  this._handleSelectionChanged.bind(this));
  }

  _projectsToListItems(projects: gapi.client.cloudresourcemanager.Project[])
      : ItemListRow[] {
    return projects.map((project) => new ItemListRow({
        columns: [project.projectId || '', project.projectNumber || ''],
        icon: 'datalab-icons:bq-project',
      }));
  }

  /**
   * Also send back the user selected path in the closing context.
   */
  getCloseResult() {
    const list = this.$.projectList as ItemListElement;
    if (list.selectedIndices.length === 1) {
      const item = list.rows[list.selectedIndices[0]];
      return {
        projectId: item.columns[1],
        projectName: item.columns[0],
      };
    } else {
      return {};
    }
  }

  _handleSelectionChanged() {
    const itemlist = this.$.projectList as ItemListElement;
    if (itemlist.selectedIndices.length === 1) {
      const item = itemlist.rows[itemlist.selectedIndices[0]];
      this.selectedProjectName = item.columns[0];
      this.selectedProjectId = item.columns[1];
    }
  }

  _handleDoubleClicked() {
    this._handleSelectionChanged();
    this._confirmClose();
  }

}

customElements.define(ProjectPickerDialogElement.is, ProjectPickerDialogElement);
