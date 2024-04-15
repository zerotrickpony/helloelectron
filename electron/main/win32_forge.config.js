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
      name: '@electron-forge/maker-squirrel',
      config: {
        "certificateFile": `${process.env.HOMEDRIVE}${process.env.HOMEPATH}\\win_cert.pfx`,
        "certificatePassword": process.env.WIN_CERT_PASSWORD,
		    "setupIcon": __dirname + "../web/appicon.ico",
        "iconUrl": "https://yourdomain.com/favicon.ico",
		    "icon": __dirname + "../web/appicon.ico",
        "loadingGif": __dirname + "/lib/win32/windows-installation.gif",
      },
    },
  ],
};
