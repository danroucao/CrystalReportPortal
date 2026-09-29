// Stable local and CI test configuration. The browser path may still be
// overridden with CHROME_BIN when Chrome is installed in a nonstandard place.
module.exports = (config) => {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-firefox-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {
        random: false,
      },
    },
    reporters: ['progress', 'kjhtml'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: [
          '--disable-gpu',
          '--disable-gpu-compositing',
          '--disable-gpu-shader-disk-cache',
          '--disable-features=Vulkan',
          '--disable-software-rasterizer',
          '--disable-dev-shm-usage',
        ],
      },
    },
    // Firefox is the default here because some Windows graphics drivers prevent
    // Chromium's headless GPU process from starting. ChromeHeadlessCI remains
    // available to CI environments that prefer Chromium.
    browsers: ['FirefoxHeadless'],
    singleRun: true,
    restartOnFileChange: false,
  });
};
