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
 * A custom even class that signals a notification should be shown with a message,
 * or hidden. The event can be fired on any element in the DOM tree, and will bubble up.
 * @param message notification message to show
 * @param show whether the notification toast should be shown or hidden. Default true.
 * @param sticky whether the notification should stick around until dismissed. Default false.
 */
class NotificationEvent extends CustomEvent {
  constructor(message = '', show = true, sticky = false) {

    const eventInit = {
      bubbles: true,
      composed: true, // Needed to pierce the shadow DOM boundaries
      detail: {
        message,
        show,
        sticky,
      },
    };

    super('notification', eventInit);
  }
}

/**
 * Notification element for Datalab.
 * This element can be dropped in any DOM element, and it will listen for
 * 'notification' events from its children elements, and show a toast with that
 * notification message. The notification can be 'sticky', in which case it
 * will not disappear automatically, and it will wait on another 'notification'
 * event that explicitly dismisses it.
 */
class NotificationElement extends Polymer.Element {

  private _nonstickyDuration = 3 * 1000;

  static get is() { return 'datalab-notification'; }

  ready() {
    super.ready();

    // Handle notification events bubbled up from other DOM elements.
    const parent = this.parentNode;
    if (parent) {
      // Put the event listener on the parent element
      (parent as ShadowRoot).host.addEventListener('notification', (e: NotificationEvent) => {
        if (e.detail.show) {
          this.show(e.detail.message, e.detail.sticky);
        } else {
          this.hide();
        }
      });
    }

  }

  /**
   * Opens the notification toast
   * @param message string to show in the toast
   * @param sticky whether the toast should not automatically close
   */
  show(message: string, sticky = false) {
    this.$.toast.text = message;
    this.$.toast.duration = sticky === true ? 0 : this._nonstickyDuration;
    this.$.toast.open();
  }

  /**
   * Closes the notification toast
   */
  hide() {
    this.$.toast.close();
  }

}

customElements.define(NotificationElement.is, NotificationElement);
