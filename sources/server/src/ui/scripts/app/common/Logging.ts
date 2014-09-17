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
 * Logging API
 */
/// <reference path="Interfaces.ts" />


/**
 * Logger that supports levels and scopes.
 */
class Logger implements app.ILogger {
  /**
   * Name of the scope under which logs will be emitted
   */
  private _scope: string;
  
  /**
   * Creates a new logger instance
   *
   * @param scope logging scope name
   */
  constructor (scope: string) {
    this._scope = scope;
  }

  /**
   * Logs the given objects at the DEBUG level
   *
   * @param ...objects one or more objects
   */
  debug (...objects: Object []) {
    this._log.apply(this, objects);
  }

  /**
   * Logs the given objects at the INFO level
   *
   * @param ...objects one or more objects
   */
  info (...objects: Object []) {
    this._log.apply(this, objects);
  }

  /**
   * Logs the given objects at the WARN level
   *
   * @param ...objects one or more objects
   */
  warn (...objects: Object []) {
    this._log.apply(this, objects);
  }

  /**
   * Logs the given objects at the ERROR level
   *
   * @param ...objects one or more objects
   */
  error (...objects: Object []) {
    this._log.apply(this, objects);
  }

  /**
   * Delegates all logging to console.log.
   *
   * Applies scope prefix to logged messages.
   * @param {Object []} ...objects [description]
   */
  private _log (...objects: Object []) {
    var scopePrefix: Object[] = [ '[' + this._scope + ']' ];
    console.log.apply(console, scopePrefix.concat(objects));
  }
}

/**
 * Get a logging instance for the given scope
 *
 * @param scope logging scope to use
 * @return Logger instance
 */
export function getLogger (scope: string): app.ILogger {
  return new Logger(scope);
}