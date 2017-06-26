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
  clear(): void;
  reset(): void;
  resize(cols: number, rows: number): void;
  on(event: string, handler: Function): void;
}

class TerminalElement extends Polymer.Element {

  private _xterm: Terminal;
  private _wsConnection: WebSocket;
  private _resizeHandler: EventListenerObject;
  private _charHeight: number;
  private _charWidth: number;

  static get is() { return "datalab-terminal"; }

  ready() {
    super.ready();
    const self = this;

    // Will be called after the custom element is done rendering.
    window.addEventListener('WebComponentsReady', function() {
      self._charHeight = self.$.sizeHelper.clientHeight;
      self._charWidth = self.$.sizeHelper.clientWidth / 10;

      self._resizeHandler = self._renderHandler.bind(self);
      window.addEventListener('resize', self._resizeHandler, true);

      ApiManager.getTerminal()
        .then((terminals: [JupyterTerminal]) => {
          return terminals.length === 0 ? ApiManager.startTerminal() : terminals[0];
        })
        .then((terminal: JupyterTerminal) => {
          self._initTerminal(terminal.name);
        });
    });
  }

  _initTerminal(terminalName: string) {
    this._wsConnection = new WebSocket('ws://' +
                                        window.location.host +
                                        '/terminals/websocket/' +
                                        terminalName);
    this._wsConnection.onopen = () => {
      this._xterm.on('data', (data: MessageEvent) => {
        this._wsConnection.send(JSON.stringify(['stdin', data]));
      });
    };

    this._wsConnection.onmessage = (event: any) => {
      const data = JSON.parse(event.data);
      if (data[0] === 'stdout') {
        this._xterm.write(data[1]);
      } else if (data[0] === 'disconnect') {
        this._xterm.reset();
        this._initTerminal(terminalName);
      }
    };
    this._xterm = new Terminal();
    this._xterm.open(this.$.theTerminal, true);
    this._renderHandler();
  }

  disconnectedCallback() {
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
    }
  }

  _renderHandler() {
    if (this._xterm) {
      const rows = this.$.theTerminal.clientHeight / this._charHeight;
      const cols = this.$.theTerminal.clientWidth / this._charWidth;
      this._xterm.resize(Math.floor(cols), Math.floor(rows));
      if (this._wsConnection.readyState === 1)
        this._wsConnection.send(JSON.stringify(["set_size", rows, cols,
                                              this.$.theTerminal.clientHeight,
                                              this.$.theTerminal.clientWidth]));
    }
  }
}

customElements.define(TerminalElement.is, TerminalElement);