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
 * Type declaration for xterm.js
 */
declare class Terminal {
  constructor(parameters?: object)
  open(element: HTMLElement, focus: boolean): void;
  write(data: string): void;
  clear(): void;
  reset(): void;
  resize(cols: number, rows: number): void;
  on(event: string, handler: (args: any) => void): void;
}

/**
 * Terminal element for Datalab.
 * This element uses xterm.js for the front end terminal element, and opens a websocket
 * connection to a Jupyter terminal on the backend. Although Jupyter supports multiple
 * terminals, this element keeps an instance of exactly one and uses it to make the user's
 * experience simpler.
 * If the user closes the terminal session, either by typing 'exit' or ctrl+d, this
 * element will automatically reset the terminal.
 */
class TerminalElement extends Polymer.Element implements DatalabPageElement {

  public focusHandler = null;
  public blurHandler = null;

  private _xterm: Terminal;
  private _wsConnection: WebSocket;
  private _charHeight: number;
  private _charWidth: number;

  static get is() { return 'datalab-terminal'; }

  ready() {
    super.ready();
    // Use the size helper element to get the height and width of a character. This
    // makes changing the style simpler, instead of hard-coding these values.
    this._charHeight = this.$.sizeHelper.clientHeight;
    this._charWidth = this.$.sizeHelper.clientWidth / 10; // The element has 10 characters.

    // Get the first terminal instance by calling the Jupyter API. If none are returned,
    // start a new one.
    TerminalManager.listTerminalsAsync()
      .then((terminals: [JupyterTerminal]) => {
        return terminals.length === 0 ? TerminalManager.startTerminalAsync() : terminals[0];
      })
      .then((terminal: JupyterTerminal) => {
        this._initTerminal(terminal.name);
      });
  }

  /**
   * Creates the front end terminal element and connects it to the backend Jupyter terminal.
   * TODO: Consider adding a loading experience while the connection is made.
   * @param terminalName name of the Jupyter terminal session to be used in websocket connection
   */
  async _initTerminal(terminalName: string) {
    // Clear any older terminal elements created.
    this.$.theTerminal.innerHTML = '';
    this._xterm = new Terminal();

    // If socket.io was loaded successfully into the page, override the existing
    // WebSocket functionality. This is needed because WebSocket is not fully
    // supported by GFE.
    if (window.hasOwnProperty('io')) {
      const w = window as any;
      w.NativeWebSocket = w.WebSocket;
      w.WebSocket = DatalabWebSocketShim;
      Utils.log.verbose('Replaced native websockets with socket.io');
    } else {
      Utils.log.error('Could not find socket.io, will not replace WebSocket. ' +
          'Terminal might not function correctly.');
    }

    // First, create the connection to the Jupyter terminal.
    const basepath = await ApiManager.getBasePath();
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this._wsConnection = new WebSocket(protocol + '//' +
                                       location.host +
                                       basepath +
                                       '/terminals/websocket/' +
                                       terminalName);

    this._wsConnection.onopen = () => {
      // Front-end to Jupyter.
      this._xterm.on('data', (data: MessageEvent) => {
        this._wsConnection.send(JSON.stringify(['stdin', data]));
      });

      // Jupyter to front-end. Intercept disconnect messages to reset the terminal.
      this._wsConnection.onmessage = (event: any) => {
        const data = JSON.parse(event.data);
        if (data[0] === 'stdout') {
          this._xterm.write(data[1]);
        } else if (data[0] === 'disconnect') {
          // TODO: Consider making the reset manual, by adding a toolbar with a button, or a popup
          // that shows when the 'disconnect' message is sent back.
          this._initTerminal(terminalName);
        }
      };

      // Now, create the front-end terminal.
      this._xterm.open(this.$.theTerminal, true);
      this.resizeHandler();
    };
  }

  /**
   * On window resize, both front-end and Jupyter terminal instances need to be resized and
   * kept in sync, otherwise line wrapping issues will happen.
   */
  resizeHandler() {
    if (this._xterm) {
      const rows = this.$.theTerminal.clientHeight / this._charHeight;
      const cols = this.$.theTerminal.clientWidth / this._charWidth;

      this._xterm.resize(Math.floor(cols), Math.floor(rows));
      this._wsConnection.send(JSON.stringify(['set_size', rows, cols]));
    }
  }
}

customElements.define(TerminalElement.is, TerminalElement);
