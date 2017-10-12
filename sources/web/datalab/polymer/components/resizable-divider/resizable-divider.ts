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
   * Position of the divider in percentage. Defaults to 50(%);
   */
  public dividerPosition = 50;

  /**
   * Set to true to completely disable the right-hand pane and the divider.
   */
  public disableRight: boolean;

  /**
   * Set to true to hide the right-hand pane.
   */
  public hideRight: boolean;

  private _boundMouseDownHandler: EventListenerOrEventListenerObject;
  private _boundMouseupHandler: EventListenerOrEventListenerObject;
  private _boundMouseMoveHandler: EventListenerOrEventListenerObject;
  private _defaultUnhidePosition = 75;
  private _dividerWidth: number;
  private _lastMouseDownPosition: number;
  private _lastMouseUpPosition: number;

  static get is() { return 'resizable-divider'; }

  static get properties() {
    return {
      disableRight: {
        observer: '_disableRightChanged',
        type: Boolean,
        value: false,
      },
      dividerPosition: {
        notify: true,
        observer: '_dividerPositionChanged',
        type: Number,
      },
      hideRight: {
        observer: '_hideRightChanged',
        type: Boolean,
        value: false,
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

    divider.addEventListener('mousedown', this._boundMouseDownHandler);
    this._dividerWidth = divider.getBoundingClientRect().width;
  }

  resizeHandler() {
    this._dividerPositionChanged();
  }

  _mouseDownHandler() {
    document.addEventListener('mousemove', this._boundMouseMoveHandler, true);
    document.addEventListener('mouseup', this._boundMouseupHandler, true);

    // Style the divider while dragging
    this.$.divider.classList.add('active');
    this._lastMouseDownPosition = this.dividerPosition;

    // Disable pointer events on the panes while dragging. This is to avoid
    // annoying hover effects that flicker as the pointer is moving faster
    // than the divider element.
    (this.$.leftPane as HTMLDivElement).style.pointerEvents = 'none';
    (this.$.rightPane as HTMLDivElement).style.pointerEvents = 'none';
  }

  _mouseUpHandler() {
    document.removeEventListener('mouseup', this._boundMouseupHandler, true);
    document.removeEventListener('mousemove', this._boundMouseMoveHandler, true);

    // stop styling the handle as active because dragging is done
    this.$.divider.classList.remove('active');
    this._lastMouseUpPosition = this.dividerPosition;

    // Re-enable pointer events on the panes
    (this.$.leftPane as HTMLDivElement).style.pointerEvents = 'all';
    (this.$.rightPane as HTMLDivElement).style.pointerEvents = 'all';
  }

  _mouseMoveHandler(event: MouseEvent) {
    const container = this.$.container as HTMLDivElement;
    const containerRect = container.getBoundingClientRect();
    const newLeftPaneWidth = event.clientX - containerRect.left;
    const widthMinusDivider = containerRect.width - this._dividerWidth;
    const newPosition = newLeftPaneWidth * 100 / widthMinusDivider;
    this.dividerPosition =
        (newPosition < 0) ? 0 : (newPosition > 100) ? 100 : newPosition;
    // Let observer call _dividerPositionChanged
  }

  _disableRightChanged(_: boolean, oldValue: boolean) {
    if (oldValue === undefined) {
      return;   // Ignore during initialization
    }
    if (this.disableRight) {
      this.hideRight = true;
      this.dividerPosition = 100;
    }
    this._dividerPositionChanged();
  }

  /**
   * Calculate the new divider position after hideRight changes.
   */
  _hideRightChanged(_: boolean, oldValue: boolean) {
    if (oldValue === undefined) {
      return;   // Leave divider position unchanged on startup
    } else if (this.hideRight) {
      this.dividerPosition = 100;
    } else {
      // Make the right pane visible
      if (this._lastMouseUpPosition > 0 &&
          this._lastMouseUpPosition < 100) {
        this.dividerPosition = this._lastMouseUpPosition;
      } else if (this._lastMouseDownPosition > 0 &&
                 this._lastMouseDownPosition < 100) {
        this.dividerPosition = this._lastMouseDownPosition;
      } else {
        this.dividerPosition = this._defaultUnhidePosition;
      }
    }
  }

  /**
   * Calculates and sets the new widths of the two panes after the divider moved.
   */
  _dividerPositionChanged() {
    const container = this.$.container as HTMLDivElement;
    const containerRect = container.getBoundingClientRect();
    const dividerWidth = this.disableRight ? 0 : this._dividerWidth;
    const widthMinusDivider = containerRect.width - dividerWidth;
    const dividerPosition =
        this.dividerPosition > -1 ? this.dividerPosition : 50;
    const newPos =
        containerRect.left + (widthMinusDivider * dividerPosition / 100);
    const divider = this.$.divider as HTMLDivElement;
    const leftPane = this.$.leftPane as HTMLDivElement;
    const rightPane = this.$.rightPane as HTMLDivElement;

    let newLeftPaneWidth = newPos - containerRect.left;
    let newRightPaneWidth = containerRect.right - newPos - dividerWidth;

    // If either pane is getting too small, make it minimum width
    // TODO: Check whether minimum width makes sense here, and bail out if it's
    // larger than half the container width
    if (newLeftPaneWidth > 0 && newLeftPaneWidth < this.minimumWidthPx) {
      newLeftPaneWidth = this.minimumWidthPx;
      newRightPaneWidth =
          containerRect.width - newLeftPaneWidth - dividerWidth;
    } else if (newRightPaneWidth > 0 && newRightPaneWidth < this.minimumWidthPx) {
      newRightPaneWidth = this.minimumWidthPx;
      newLeftPaneWidth =
          containerRect.width - newRightPaneWidth - dividerWidth;
    }

    leftPane.style.width = newLeftPaneWidth + 'px';
    divider.style.left = leftPane.style.width;
    rightPane.style.width = newRightPaneWidth + 'px';
    rightPane.style.left = (newLeftPaneWidth + dividerWidth) + 'px';
  }

}

customElements.define(ResizableDividerElement.is, ResizableDividerElement);
