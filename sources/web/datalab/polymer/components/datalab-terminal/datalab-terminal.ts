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

declare class Terminal {
  constructor(parameters?: object)
  open(element: HTMLElement, focus: boolean): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
}

class TerminalElement extends Polymer.Element {

  private _terminal: Terminal;
  private _resizeHandler: EventListenerObject;
  private _charHeight: number;
  private _charWidth: number;

  static get is() { return "datalab-terminal"; }

  ready() {
    super.ready();
    const self = this;

    this._terminal = new Terminal();
    this._terminal.open(this.$.theTerminal, true);
    this._terminal.write('Hello world');

    // Will be called after the custom element is done rendering.
    window.addEventListener('WebComponentsReady', function() {

      self._charHeight = self.$.sizeHelper.clientHeight;
      self._charWidth = self.$.sizeHelper.clientWidth / 10;

      self._renderHandler();
      self._resizeHandler = self._renderHandler.bind(self);
      window.addEventListener('resize', self._resizeHandler, true);
    });
  }

  disconnectedCallback() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
  }

  _renderHandler() {
    const rows = this.$.theTerminal.clientHeight / this._charHeight;
    const cols = this.$.theTerminal.clientWidth / this._charWidth;
    this._terminal.resize(cols, rows);
  }
}

customElements.define(TerminalElement.is, TerminalElement);