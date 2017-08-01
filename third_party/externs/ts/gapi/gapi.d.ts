/** Definition of the gapi module we load from https://apis.google.com/js/api.js
 * that adds a "gapi" variable on the root.
 */

declare module gapi.client {
  export function init(args: {
    discoveryDocs?: string[];
    clientId?: string;
    scope?: string;
  }): Promise<void>;

  export function load(name: string, version: string): Promise<void>;

  interface HttpResponse<T> {
    body: string;
    headers: Array<Object>;
    result: T;
    status: number;
    statusText: string;
  }

  export class HttpRequest<T> extends Promise<HttpResponse<T>> {}
}

declare module gapi.auth2 {
  export interface IsSignedIn {
    get(): boolean;
    listen(listener: (signedIn: boolean) => any): void;
  }

  export interface CurrentUser {
    get(): GoogleUser;
    listen(listener: (user: GoogleUser) => any): void;
  }

  export interface GoogleUser {
    getId(): string;
    getBasicProfile(): BasicProfile;
  }

  export interface BasicProfile {
    getId(): string;
    getEmail(): string;
  }

  export interface SignInOptions {
    prompt?: string;
  }

  export class AuthInstance {
    signIn(options?: SignInOptions): any;
    signOut(): any;
    isSignedIn: IsSignedIn;
    currentUser: CurrentUser;
  }

  export function getAuthInstance(): AuthInstance;
}

declare namespace gapi {
  export function load(name: string, cb: () => void): void;
}
