// Karma configuration
// Generated on Mon Jun 22 2015 08:47:39 GMT-0700 (PDT)

module.exports = function(config) {
  config.set({
    basePath: '',

    files: [
      'test-main.js',
      {pattern: 'app/**/*.js', included: false},
      {pattern: 'tests/**/*.js', included: false},
    ],

    exclude: [
      'main.js'
    ],

    frameworks: ['jasmine', 'requirejs'],
    browserNoActivityTimeout: 10000,
    preprocessors: {},
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false
  });
};
