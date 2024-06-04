module.exports = {
  packagerConfig: {
    executableName: 'helloelectron',
    icon: 'web/appicon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: 'web/appicon.png'
        }
      }
    },
  ],
};
