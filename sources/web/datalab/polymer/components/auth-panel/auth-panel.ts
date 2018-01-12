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
 * Auth sign-in/sign-out panel.
 * This element provides buttons to sign in and out, and display some
 * information when signed in.
 */
@Polymer.decorators.customElement('auth-panel')
class AuthPanel extends Polymer.Element {

  @Polymer.decorators.property({type: Boolean})
  _signedIn = false;

  @Polymer.decorators.property({type: String})
  _userInfo = '';

  _promptOnSignIn = false;

  ready() {
    super.ready();
    GapiManager.auth.listenForSignInChanges(this._signInChanged.bind(this))
      .catch((e) => {
        Utils.showErrorDialog('Authentication error', e.message);
      });
  }

  _signInClicked() {
    GapiManager.auth.signIn(this._promptOnSignIn);
  }

  _signOutClicked() {
    // If the user explicitly signs out, then set a flag so that we ask for
    // confirmation when he logs back in.
    this._promptOnSignIn = true;
    GapiManager.auth.signOut()
      .catch()
      .then(() => window.location.reload());
  }

  _signInChanged(signedIn: boolean) {
    this._signedIn = signedIn;
    if (signedIn) {
      GapiManager.auth.getSignedInEmail()
        .then((email: string) => {
          this._userInfo = 'Signed in as ' + email;

          const ev = new Event('signInOutDone');
          this.dispatchEvent(ev);
        });
    }
  }
}
