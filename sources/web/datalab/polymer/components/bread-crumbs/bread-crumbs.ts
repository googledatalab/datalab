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

class BreadCrumbsElement extends Polymer.Element {

  public crumbs: string[];

  static get is() { return 'bread-crumbs'; }

  static get properties() {
    return {
      crumbs: {
        type: Array,
        value: [],
      },
    };
  }

  _crumbClicked(e: MouseEvent) {
    const index = this.$.breadcrumbsTemplate.indexForElement(e.target);
    if (index !== null) {
      const ev = new ItemClickEvent('crumbClicked', { detail: {index} });
      this.dispatchEvent(ev);
    }
  }

  _rootClicked() {
    this.dispatchEvent(new ItemClickEvent('rootClicked'));
  }

}

customElements.define(BreadCrumbsElement.is, BreadCrumbsElement);
