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


/// <reference path="../../typedefs/node/node.d.ts" />
/// <reference path="../../typedefs/express/express.d.ts" />


import http = require('http');
import express = require('express');

var PORT = parseInt(process.env['DATALAB_PORT'] || 8080);

var expressApp = express();
var httpServer = http.createServer(expressApp);

console.log("Starting DataLab server on port " + PORT);
httpServer.listen(PORT);
