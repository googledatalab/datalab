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

/**
 * The NodeJS backend with RESTful task API and websocket notifications
 */
var http = require('http');
var express = require('express');
var path = require('path');
var _ = require('underscore');
var socketio = require('socket.io');

// Setup the server to handle both websocket and http traffic
var service = express(); // TODO: rename this to something more distinctive
var httpServer = http.createServer(service);
var websocketServer = socketio.listen(httpServer);

// Mount static content at server root URL
service.use("/", express.static(path.join(__dirname, "../ui")));
// Enable JSON POST bodies
service.use(express.json());

// Start the server
httpServer.listen(8000);

// Note: everything below would be split into separate modules realistically,
// but this is just a quick backend to demo the front-end bits

/**
 * Track the state of tasks with simple in-memory hash
 */
var idToTask = {};

/**
 * Log current tasks to console for debugging
 */
function logTasks () {
  console.log(JSON.stringify(_.values(idToTask)));
}

/**
 * Get a list of tasks from the hash
 */
function getAllTasks() {
  return _.values(idToTask);
}

/**
 * Send a message to all connected clients that the task state has changed.
 *
 * Message payload includes the new task state
 */
function broadcastTasks () {
  websocketServer.sockets.emit('task-update', {
    tasks: getAllTasks()
  });
}


// Task HTTP API definitions
var tasksUrl = '/api/tasks';
var singleTaskUrl = tasksUrl + '/:id';

/**
 * Get the full list of available tasks
 */
service.get(tasksUrl, function (request, response) {
  console.log('GET /api/tasks: list');
  logTasks();
  response.send(getAllTasks());
});

/**
 * Get a single task by looking up the given ID
 */
service.get(singleTaskUrl, function (request, response) {
  var taskId = request.params.id;
  console.log('GET /api/tasks/' + taskId);
  if (!_.has(idToTask, taskId)) {
    response.send(404, "No task by that name!");
  }
  response.send(idToTask[taskId]);
});

/**
 * Persist a single task into the in-memory hash with given ID
 */
service.put(singleTaskUrl, function (request, response) {
  var taskId = request.params.id;
  console.log('PUT id="' + taskId + '"');
  idToTask[taskId] = request.body;
  logTasks();
  response.send();
  broadcastTasks();
});

/**
 * Delete a single task with given ID from the in-memory hash
 */
service.delete(singleTaskUrl, function (request, response) {
  var taskId = request.params.id;
  console.log('DELETE id=' + taskId + '"');
  // it's ok if the value doesn't exist, this operation is idempotent
  delete idToTask[taskId];
  logTasks();
  response.send();
  broadcastTasks();
});
