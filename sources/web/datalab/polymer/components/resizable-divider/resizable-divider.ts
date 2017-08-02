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
 * Resizable divider element for Datalab.
 * This element is a container for two elements with a vertical resize divider.
 */
class ResizableDividerElement extends Polymer.Element {

  /**
   * Minimum pane width in pixels.
   */
  public minimumWidthPx: number;

  private _boundMouseDownHandler: EventListenerOrEventListenerObject;
  private _boundMouseupHandler: EventListenerOrEventListenerObject;
  private _boundMouseMoveHandler: EventListenerOrEventListenerObject;
  private _dividerWidth = 4; // This matches the css variable --divider-width

  static get is() { return 'resizable-divider'; }

  static get properties() {
    return {
      minimumWidthPx: {
        type: Number,
        value: 50,
      },
    };
  }

  ready() {
    super.ready();

    this._boundMouseDownHandler = this._mouseDownHandler.bind(this);
    this._boundMouseupHandler = this._mouseUpHandler.bind(this);
    this._boundMouseMoveHandler = this._resizePanes.bind(this);

    this.$.divider.addEventListener('mousedown', this._boundMouseDownHandler);
  }

  _mouseDownHandler(event: MouseEvent) {
    document.addEventListener('mousemove', this._boundMouseMoveHandler, true);
    document.addEventListener('mouseup', this._boundMouseupHandler, true);

    // style the handle while dragging
    this.$.divider.classList.add('active');

    // (stop panes from receiving mouse events and inteferring with the drag
    // works great for the iframe, not for CodeMirror
    this.$.p1.style.pointerEvents = 'none';
    this.$.p2.style.pointerEvents = 'none';

    // resize the pane and a neighour
    this._resizePanes(event);
  }

  _mouseUpHandler() {
    document.removeEventListener('mouseup', this._boundMouseupHandler, true);
    document.removeEventListener('mousemove', this._boundMouseMoveHandler, true);

    // stop styling the handle as active because dragging is done
    this.$.divider.classList.remove('active');

    // let the panes have mouse events again
    this.$.p1.style.pointerEvents = 'initial';
    this.$.p2.style.pointerEvents = 'initial';
  }

  /**
   * Resize 2 panes on either side of the handle
   */
  _resizePanes(event: MouseEvent) {
    const container = this.$.container as HTMLDivElement;
    const p1 = this.$.p1 as HTMLDivElement;
    const p2 = this.$.p2 as HTMLDivElement;
    const containerRect = container.getBoundingClientRect();

    const newP1Width = event.clientX - containerRect.left - this._dividerWidth;
    const newP2Width = containerRect.right - event.clientX - this._dividerWidth;

    // Stop if either pane is getting too small
    if (newP1Width < this.minimumWidthPx || newP2Width < this.minimumWidthPx) {
      return;
    }

    p1.style.width = newP1Width / containerRect.width * 100 + '%';
    p2.style.width = newP2Width / containerRect.width * 100 + '%';
  }

}

customElements.define(ResizableDividerElement.is, ResizableDividerElement);
