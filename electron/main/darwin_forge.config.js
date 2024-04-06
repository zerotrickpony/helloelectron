const path = require('path');

module.exports = {
  packagerConfig: {
    executableName: 'helloelectron',
    icon: 'web/lib/images/appicon',
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
