/*
 * Copyright 2015 Google Inc. All rights reserved.
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

interface magicTypeMap {
    [index : string] : RegExp[];
}

// map between regex and CodeMirror mode name
var magicMap : magicTypeMap = {
    "text/x-sql" : [/^\%\%bigquery sql\s/],
    "text/javascript" : [/^%%javascript/, /^%%bigquery udf/]
};

/**
 *
 * @param content, string of text, which is used to determine the correct mode
 * @param fallback, TODO (rnabel) add description
 * @returns {string}, name of the mode, if no match found "python" is returned
 */
export var magicDetector = function (content : string, fallback? : string) : string {
    // check for each key in magicMap whether it matches the content string
    var mmapKey : string;
    for (mmapKey in magicMap) {
        var index : number;
        for (index = 0; index < magicMap[mmapKey].length; index++) {

            var matches : RegExpMatchArray = content.match(magicMap[mmapKey][index]);

            if (matches) {
                return mmapKey; // TODO (rnabel) make one line, 2 lines for testing purposes
            }
        }
    }

    return fallback;
};