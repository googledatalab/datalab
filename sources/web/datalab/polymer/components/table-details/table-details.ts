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
 * Table details pane element for Datalab.
 * This element is designed to be displayed in a side bar that displays more
 * information about a selected BigQuery table.
 */
class TableDetailsElement extends Polymer.Element {

  /**
   * Table object whose details to show.
   */
  public table: gapi.client.bigquery.BigqueryTable | null;

  static get is() { return 'table-details'; }

  static get properties() {
    return {
    };
  }

}

customElements.define(TableDetailsElement.is, TableDetailsElement);
