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
   * Minimum pane width in pixels. Defaults to 50(px);
   */
  public minimumWidthPx: number;

  /**
   * Initial position of the divider in percentage. Defaults to 50(%);
   */
  public initialDividerPosition: number;

  private _boundMouseDownHandler: EventListenerOrEventListenerObject;
  private _boundMouseupHandler: EventListenerOrEventListenerObject;
  private _boundMouseMoveHandler: EventListenerOrEventListenerObject;
  static get is() { return 'resizable-divider'; }

  static get properties() {
    return {
      initialDividerPosition: {
        type: Number,
        value: 50,
      },
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
    this._boundMouseMoveHandler = this._mouseMoveHandler.bind(this);

    const divider = this.$.divider as HTMLDivElement;
    const container = this.$.container as HTMLDivElement;

    divider.addEventListener('mousedown', this._boundMouseDownHandler);

    // Initialize the divider position. We need to calculate this initial
    // position relative to the container element.
    const containerRect = container.getBoundingClientRect();
    const pos = containerRect.left + (containerRect.width * this.initialDividerPosition / 100);
    this._resizePanes(pos);
  }

  _mouseDownHandler() {
    document.addEventListener('mousemove', this._boundMouseMoveHandler, true);
    document.addEventListener('mouseup', this._boundMouseupHandler, true);

    // Style the divider while dragging
    this.$.divider.classList.add('active');
  }

  _mouseUpHandler() {
    document.removeEventListener('mouseup', this._boundMouseupHandler, true);
    document.removeEventListener('mousemove', this._boundMouseMoveHandler, true);

    // stop styling the handle as active because dragging is done
    this.$.divider.classList.remove('active');
  }

  _mouseMoveHandler(event: MouseEvent) {
    this._resizePanes(event.clientX);
  }

  /**
   * Calculates and sets the new widths of the two panes.
   */
  _resizePanes(newPos: number) {
    const container = this.$.container as HTMLDivElement;
    const divider = this.$.divider as HTMLDivElement;
    const leftPane = this.$.leftPane as HTMLDivElement;
    const rightPane = this.$.rightPane as HTMLDivElement;

    const containerRect = container.getBoundingClientRect();

    let newLeftPaneWidth = newPos - containerRect.left;
    let newRightPaneWidth = containerRect.right - newPos;

    // If either pane is getting too small, make it minimum width
    // TODO: Check whether minimum width makes sense here, and bail out if it's
    // larger than half the container width
    if (newLeftPaneWidth < this.minimumWidthPx) {
      newLeftPaneWidth = this.minimumWidthPx;
      newRightPaneWidth = containerRect.width - newLeftPaneWidth;
    } else if (newRightPaneWidth < this.minimumWidthPx) {
      newRightPaneWidth = this.minimumWidthPx;
      newLeftPaneWidth = containerRect.width - newRightPaneWidth;
    }

    leftPane.style.width = newLeftPaneWidth / containerRect.width * 100 + '%';
    rightPane.style.width = newRightPaneWidth / containerRect.width * 100 + '%';
    divider.style.left = leftPane.style.width;
  }

}

customElements.define(ResizableDividerElement.is, ResizableDividerElement);
