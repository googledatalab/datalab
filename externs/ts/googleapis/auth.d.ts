// Type definitions for googleapis.auth
// Project: https://github.com/google/google-auth-library-nodejs
//
// This is not a proper definition; just enough for Datalab to compile.

declare module "auth" {
    export class OAuth2 {
        generateAuthUrl(properties: any): string;
        getToken(code: string, callback: any): void;
        refresh_token(callback: any): void;
        setCredentials(tokens: any): void;
    }
}

