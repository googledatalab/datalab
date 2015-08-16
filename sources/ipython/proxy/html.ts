/*
 * Copyright 2014 Google Inc. All rights reserved.
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

/// <reference path="common.d.ts" />

export interface Template {
  (data: common.Map<string>): string;
}

export function createTemplate(html: string): Template {
  var tagRegex: RegExp = /<%(.+?)%>/g;
  var codeRegex: RegExp = /(^( )?(var|if|for|else|switch|case|break|{|}|;))(.*)?/g;
  var code = 'with(obj) { var r=[];\n';
  var index = 0;

  function add(line: string, js?: boolean): void {
    js ? (code += line.match(codeRegex) ? line + '\n' : 'r.push(' + line + ');\n') :
         (code += line != '' ? 'r.push("' + line.replace(/"/g, '\\"') + '");\n' : '');
  }

  var match: RegExpMatchArray;
	while (match = tagRegex.exec(html)) {
		add(html.slice(index, match.index));
    add(match[1], true);
		index = match.index + match[0].length;
	}
	add(html.substr(index, html.length - index));
	code = (code + 'return r.join(""); }').replace(/[\r\t\n]/g, '');

  return <Template> new Function('obj', code);
}
