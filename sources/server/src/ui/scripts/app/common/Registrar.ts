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


/// <reference path="../../../../../../../externs/ts/angularjs/angular.d.ts" />
/// <reference path="Interfaces.ts" />


/**
 * Container for Angular providers to make them available post-angular bootstrap.
 *
 * Facilitates lazy-loading by allowing "late" registration of Angular entities.
 */
export class Registrar implements app.IRegistrar {
  private _controllerProvider: ng.IControllerProvider;
  private _compileProvider: ng.ICompileProvider;
  private _filterProvider: ng.IFilterProvider;
  private _provideService: ng.auto.IProvideService;

  constructor (
      controllerProvider: ng.IControllerProvider,
      compileProvider: ng.ICompileProvider,
      filterProvider: ng.IFilterProvider,
      provide: ng.auto.IProvideService) {
    this._controllerProvider = controllerProvider;
    this._compileProvider = compileProvider;
    this._filterProvider = filterProvider;
    this._provideService = provide;
  }

  /**
   * Registers the given constructor as an angular controller
   *
   * @param name controller name used for injection within angular
   * @param constructor TypeScript class or constructor function defining the controller
   */
  controller (name: string, constructor: Function): void {
    this._controllerProvider.register(name, constructor);
  }

  /**
   * Registers the given factory function as an angular directive
   *
   * Note that directive names are registered as camelCased but referenced within templates
   * as "snake-cased".  For example, registering a directive named "fooBarBaz" here will result
   * can be referred to as <foo-bar-baz> within angular templates.
   *
   * @param name directive name (camelCased)
   * @param directiveFactory function that creates and returns a directive definition
   */
  directive (name: string, directiveFactory: Function): void {
    this._compileProvider.directive(name, directiveFactory);
  }

  /**
   * Registers the given constructor as an angular service
   *
   * @param name service instance name used for injection within angular
   * @param constructor TypeScript class or constructor function defining the service
   */
  service (name: string, constructor: Function): void {
    this._provideService.service(name, constructor);
  }

  /**
   * Registers the given factory function as an angular "factory"
   *
   * @param name service instance name used for injection within angular
   * @param serviceFactory function that returns an instance of the service
   */
  factory (name: string, serviceFactory: Function): void {
    this._provideService.factory(name, serviceFactory);
  }

  /**
   * Registers the given constant with angular
   *
   * @param name name of the contant
   * @param value value of the constant
   */
  constant (name: string, value: any): void {
    this._provideService.constant(name, value);
  }

  /**
   * Registers the given value with angular
   *
   * @param name the name of the value
   * @param value the value
   */
  value (name: string, value: any): void {
    this._provideService.value(name, value);
  }

  /**
   * Registers a decorator with angular
   *
   * @param name the name of the decorator
   * @param decorator a decorator function (see angular docs for reference here)
   */
  decorator (name: string, decorator: Function): void {
    this._provideService.decorator(name, decorator);
  }

  /**
   * Registers a filter with angular
   *
   * @param name the name of the filter
   * @param filterFactory factory function for generating filter instances
   */
  filter (name: string, filterFactory: Function): void {
    this._filterProvider.register(name, filterFactory);
  }

}
