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

/// <reference path="../node_modules/@types/mocha/index.d.ts" />
/// <reference path="../node_modules/@types/chai/index.d.ts" />
/// <reference path="../components/resizable-divider/resizable-divider.ts" />

/*
 * For all Polymer component testing, be sure to call Polymer's flush() after
 * any code that will cause shadow dom redistribution, such as observed array
 * mutation, wich is used by the dom-repeater in this case.
 */

function dragAndDrop(element: HTMLElement, x1: number, y1: number, x2: number, y2: number) {
  const clickInfo: MouseEventInit = {
    clientX: x1,
    clientY: y1,
  };
  element.dispatchEvent(new MouseEvent('mousedown', clickInfo));

  const moveInfo: MouseEventInit = {
    clientX: x2,
    clientY: y2,
  };
  document.dispatchEvent(new MouseEvent('mousemove', moveInfo));

  document.dispatchEvent(new MouseEvent('mouseup'));
}

describe('<resizable-divider>', () => {
  let testFixture: ResizableDividerElement;
  let divider: HTMLDivElement;
  let left: HTMLDivElement;
  let right: HTMLDivElement;

  beforeEach(() => {
    testFixture = fixture('resizable-divider-fixture');
    divider = testFixture.$.divider;
    // Have to use querySelector to get the pane's slotted elements because
    // they're in the inserted element's light DOM
    left = testFixture.querySelector('#left-pane') as HTMLDivElement;
    right = testFixture.querySelector('#right-pane') as HTMLDivElement;
  });

  it('inserts the given elements into panes', () => {

    assert(!!left, 'left pane should exist under the divider element');
    assert(!!right, 'right pane should exist under the divider element');

    assert(left.innerText === 'left pane', 'left pane\'s contents should appear in left slot');
    assert(right.innerText === 'right pane', 'right pane\'s contents should appear in right slot');
  });

  it('shows left pane to the left of the right pane, and divider in between', () => {
    const offset = testFixture.getBoundingClientRect().left;
    assert(left.getBoundingClientRect().left === offset, 'left pane should stick to the left');
    assert(left.getBoundingClientRect().right === offset + 200,
        'left pane should extend all the way to the middle of the container');

    assert(divider.getBoundingClientRect().left === offset + 200,
        'divider should start at the middle of the container');

    assert(right.getBoundingClientRect().left === offset + 200,
        'right pane should start at the middle of the container');
    assert(right.getBoundingClientRect().left === offset + 200,
        'right pane stick to the right of the container');
  });

  it('makes child panes fill height', () => {
    assert(left.getBoundingClientRect().height === 800, 'left pane should be fill the height');
    assert(right.getBoundingClientRect().height === 800, 'right pane should be fill the height');
  });

  it('shows panes with half the element width by default', () => {
    assert(left.getBoundingClientRect().width === 200, 'left pane should be half the width');
    assert(right.getBoundingClientRect().width === 200, 'right pane should be half the width');
  });

  it('resizes panes when divider is dragged', () => {
    const x = divider.getBoundingClientRect().left;
    const y = divider.getBoundingClientRect().top;
    const offset = testFixture.getBoundingClientRect().left;

    dragAndDrop(divider, x, y, x - 100, y + 300);

    assert(left.getBoundingClientRect().width === 100,
        'left pane should be 100px after resizing');
    assert(right.getBoundingClientRect().width === 300,
        'right pane should be 100px after resizing');
    assert(divider.getBoundingClientRect().left === offset + 100,
        'divider should move with mouse when resizing');
  });

});
