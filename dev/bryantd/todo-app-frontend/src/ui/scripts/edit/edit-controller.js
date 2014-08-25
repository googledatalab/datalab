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
 * Controller for the task edit page
 */
define(['ng-app', 'common/task-api', 'common/task-notifier-factory'], function (app) {
  'use strict';

  function TodoEditController (TaskApi, TaskNotifier) {
    this.taskNotifier = TaskNotifier;
    this.completedTasks = [];

    // The value of the "new task" input element
    this.newTaskText = '';

    this._TaskApi = TaskApi;
  }

  /**
   * Marks the task as complete and moves it to the completed list
   */
  TodoEditController.prototype.completeTask = function (task, index) {
    task.completed = true;
    this._deleteTask(task, index);
    this.completedTasks.push(task);
  }

  /**
   * Creates a new task and persists it to the backend
   * @return {[type]} [description]
   */
  TodoEditController.prototype.createTask = function () {
    // If the text is all whitespace or empty, don't actually create a new task
    var newTaskDescription = this.newTaskText.trim();
    if (!newTaskDescription.length) return;

    // TODO: could make this a separate object with constructor...
    var newTask = {
      id: this._generateUUID(),
      description: newTaskDescription,
      completed: false
    };

    // First persist the task to the backend
    this._TaskApi.update(newTask);
    // Reset the new task input text 
    this.newTaskText = '';
  };

  /**
   * Deletes the given task
   */
  TodoEditController.prototype._deleteTask = function (task, index) {
    // Delete from the backend
    this._TaskApi.delete(task);
  };

  /**
   * Generates a random UUID
   * 
   * Borrowed from http://stackoverflow.com/a/8809472
   */
  TodoEditController.prototype._generateUUID = function () {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x7|0x8)).toString(16);
    });
    return uuid;
  }

  // NOTE: Depending on our minimization approach, we may need to
  //       explicitly list the controller (constructor) args (due to name mangling)
  //
  //       app.controller('Ctrl', ['arg1', 'arg2', CtrlConstructorFunction]);
  app.controller('TodoEditController', TodoEditController);

  return TodoEditController;
});
