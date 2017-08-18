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
  * Breadcrumb element for Datalab. It takes an array of strings that are
  * displayed as a horizontal list of links representing a POSIX-like path. A
  * root link is always displayed at the beginning of the list. Clicking a link
  * dispatches a 'crumbClicked' custom event that contains the index of the
  * clicked item. Overflowing links will be hidden from the left side, and an
  * ellipsis link appears when this is the case. Clicking the ellipsis
  * dispatches the custom event with the index before the last visible item.
  * Clicking the root link dispatches a 'rootClicked' custom event.
  */
class BreadCrumbsElement extends Polymer.Element {

  /**
   * Array of path parts to display as breadcrumbs.
   */
  public crumbs: string[];

  /**
   * Index of the last path link that was fit in the breadcrumbs bar.
   */
  public lastVisibleIndex: number;

  // Length of the first crumb, which is either the home crumb (/), or ellipsis
  // crumb (...).
  private readonly _ellipsisCrumbWidth = 55;

  static get is() { return 'bread-crumbs'; }

  static get properties() {
    return {
      crumbs: {
        observer: '_crumbsChanged',
        type: Array,
        value: [],
      },
    };
  }

  _crumbsChanged() {
    this.resizeHandler();
  }

  resizeHandler() {
    // Let the items render first, before hiding overflowing items
    Polymer.dom.flush();

    const container = this.$.breadcrumb as HTMLDivElement;
    const maxWidth = container.offsetWidth - this._ellipsisCrumbWidth;

    const children = container.querySelectorAll('div.part') as NodeListOf<HTMLDivElement>;

    if (!children.length) {
      return;
    }

    // Find the index of the last breadcrumb we can fit, starting from the right
    // We must fit at least the right-most child, so this is the starting point.
    this.lastVisibleIndex = children.length - 1;
    children[this.lastVisibleIndex].classList.remove('hidden');
    let runningWidth = children[this.lastVisibleIndex].offsetWidth;

    // Stop when we find the first element that we cannot fit.
    for (let i = this.lastVisibleIndex - 1;
         i >= 0 && runningWidth + children[i].offsetWidth < maxWidth;
         --i) {
      this.lastVisibleIndex = i;
      children[this.lastVisibleIndex].classList.remove('hidden');
      runningWidth += children[this.lastVisibleIndex].offsetWidth;
    }

    // Hide all breadcrumbs to the left of the last visible index
    for (let i = 0; i < this.lastVisibleIndex; ++i) {
      children[i].classList.add('hidden');
    }

    // If we managed to show all crumbs, hide the ellipsis div
    if (this.lastVisibleIndex === 0) {
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

  _ellipsisClicked() {
    const ev = new ItemClickEvent('crumbClicked', { detail: {index: this.lastVisibleIndex - 1} });
    this.dispatchEvent(ev);
  }

  _rootClicked() {
    this.dispatchEvent(new ItemClickEvent('rootClicked'));
  }

}

customElements.define(BreadCrumbsElement.is, BreadCrumbsElement);
