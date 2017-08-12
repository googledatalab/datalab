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

  private _visibleCrumbs: string[];

  static get is() { return 'bread-crumbs'; }

  static get properties() {
    return {
      _visibleCrumbs: {
        type: Array,
        value: [],
      },
      crumbs: {
        observer: '_crumbsChanged',
        type: Array,
        value: [],
      },
    };
  }

  ready() {
    super.ready();

    window.addEventListener('resize', () => this._resizeHandler());
  }

  _crumbsChanged() {
    this._visibleCrumbs = this.crumbs;
    this._resizeHandler();
  }

  _resizeHandler() {
    // Let the items render first, before hiding overflowing items
    Polymer.dom.flush();

    const container = this.$.breadcrumb as HTMLDivElement;
    const maxWidth = container.offsetWidth - 55;

    const children = container.querySelectorAll('div.part') as NodeListOf<HTMLDivElement>;

    if (!children.length) {
      return;
    }

    // Find the index of the last breadcrumb we can fit, starting from the right
    // We must fit at least the right-most child, so this is the starting point
    let lastVisibleChild = children.length - 1;
    let runningWidth = children[children.length - 1].offsetWidth;
    for (let i = children.length - 2; i >= 0; --i) {
      const child = children[i];
      if (runningWidth + child.offsetWidth < maxWidth) {
        runningWidth += child.offsetWidth;
        child.classList.remove('hidden');
        lastVisibleChild = i;
      } else {
        break;
      }
    }

    // Hide all breadcrumbs to the left of the last visible index
    for (let i = 0; i < lastVisibleChild; ++i) {
      children[i].classList.add('hidden');
    }

    // If we managed to show all crumbs, hide the ellipsis div
    if (lastVisibleChild === 0) {
      this.$.ellipsisCrumb.classList.add('hidden');
      this.$.homeCrumb.classList.remove('hidden');
    } else {
      this.$.ellipsisCrumb.classList.remove('hidden');
      this.$.homeCrumb.classList.add('hidden');
    }
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
