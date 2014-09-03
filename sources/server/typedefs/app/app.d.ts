/// <reference path="../angularjs/angular.d.ts" />

declare class Registrar {
    private controllerProvider;
    private compileProvider;
    private filterProvider;
    private provideService;
    static $inject: string[];
    constructor(controllerProvider: ng.IControllerProvider, compileProvider: ng.ICompileProvider, filterProvider: ng.IFilterProvider, provide: ng.auto.IProvideService);
    public controller(name: string, constructor: Function): void;
}

// TODO(bryantd): Find a way to get aliases for complex object literals like the return value below
declare function provideRegistrar(): {
    configure: (controllerProvider: ng.IControllerProvider, compileProvider: ng.ICompileProvider, filterProvider: ng.IFilterProvider, provide: ng.auto.IProvideService) => void;
    $get: () => Registrar;
};

// TODO(bryantd): This was manually generated via "tsc -d"; automate the process of generating
// definitions file for the app code and concatenating them into this app.d.ts file