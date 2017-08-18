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
 * Interface for an element that is shown as a navigation page in Datalab.
 * These elements can support resizing, focusing, and blurring, and so must
 * define the functions below if that functionality is needed, otherwise
 * explicitly set it to null.
 */
interface DatalabPageElement extends Polymer.Element {
  resizeHandler: (() => void) | null;
  focusHandler: (() => void) | null;
  blurHandler: (() => void) | null;
}
