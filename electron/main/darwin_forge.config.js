const path = require('path');

module.exports = {
  packagerConfig: {
    executableName: 'helloelectron',
    icon: 'web/appicon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
};
