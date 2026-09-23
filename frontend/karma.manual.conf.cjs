module.exports = (config) => {
  // Attach an already-running browser when the local headless launcher cannot start.
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: { clearContext: false },
    reporters: ['dots'],
    browsers: [],
    singleRun: false,
    autoWatch: false,
  });
};
