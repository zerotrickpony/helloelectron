const path = require('path');

module.exports = {
  packagerConfig: {
    executableName: 'helloelectron',
    icon: 'web/appicon',
    osxSign: {},
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
};
