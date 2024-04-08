#!/bin/node

// This script builds the project to a locally runnable state. Typescript errors are
// emitted, and it sets up symlinks for in-place local running. To package the app
// for distribution, look at ./scripts/package.js instead.

import fs from 'fs';
import {execScript, execNpm, projectPath, runSteps, symlinkSync, listDirR, readFileLines,
        execScriptAndGetResult, rmProjectFile, parsePackageJson, stripSourceMap} from './_base.js';

const COMMANDS = new Map([
  ['setup', ['First time installation and build',
      cleanOut, cleanNpm, install, buildMain, buildWeb, buildCss]],
  ['install', ['Just does NPM install',
      install]],
  ['clean', ['Erases all build output',
      cleanOut, buildMain, buildWeb, buildCss]],
  ['build', ['Builds the electron project for development mode',
      buildMain, buildWeb, buildCss]],
  ['web', ['Builds just the render process Typescript and CSS',
      buildWeb, buildCss]],
  ['css', ['Builds just the CSS',
      buildCss]],
  ['icons', ['Generates the icon files the packaged Electron app',
      buildIcons]],
  ['run', ['Builds and runs the Electron app in development mode',
      buildMain, buildWeb, buildCss, runDev]],
  ['package', ['Packages a distributable Electron binary for the current platform',
      cleanOut, buildMain, buildWeb, buildCss, buildIcons, packageElectron]],
  ['help', ['Prints this help message',
      printHelp]]
]);

const HELP = new Map([
  [cleanOut, 'Erases all build and package output'],
  [cleanNpm, 'Erases all node_modules so they can be npm installed again'],
  [install, 'Performs NPM install on both main and render process sub-modules'],
  [buildMain, 'Build typescript and electron dependencies for the main process'],
  [buildWeb, 'Builds typescript into compiled.js and electron dependencies for the render process'],
  [buildCss, 'Builds the CSS into compiled.css'],
  [runDev, 'Quickly launches the Electron app in development mode (pre-packaged)'],
  [buildIcons, 'Generates app icons for the current platform.'],
  [packageElectron, 'Packages a distributable Electron binary for the current platform.'],
  [printHelp, 'Shows this help message']
]);

function parseSteps() {
  const text = process.argv[process.argv.length - 1];
  const commands = COMMANDS.get(text.toLowerCase());
  if (!commands) {
    return COMMANDS.get('build').slice(1);
  } else {
    return commands.slice(1);
  }
}

await runSteps(async x => {
  for (const step of parseSteps()) {
    await step();
  }
});

// Erases all output
async function cleanOut() {
  fs.rmSync(projectPath('out'), {recursive: true, force: true});
}

// Erases all NPM packages
async function cleanNpm() {
  fs.rmSync(projectPath('main/node_modules'), {recursive: true, force: true});
  fs.rmSync(projectPath('web/node_modules'), {recursive: true, force: true});
}

// NPM install
async function install() {
  await execNpm(projectPath('main'), 'install');
  await execNpm(projectPath('web'), 'install');

  if (process.platform == 'darwin') {
    // This thing only works on Mac; we use it during icon generation
    await execNpm(projectPath('main'), 'install', '--no-save', 'iconz@0.3.9');
  }
}

// Builds the main process code
async function buildMain() {
  // Build the main process Typescript
  const main = projectPath('main');
  const tsc = projectPath('main/node_modules/.bin/tsc');
  await execScript(main, tsc, '--project', 'main_tsconfig.json');

  // The source map for electronpreload.ts can never work because it's unservable
  stripSourceMap(projectPath('out/build/electronpreload.js'));

  // Forward node_modules into the build directory using symlinks
  symlinkSync(projectPath('main/node_modules'), projectPath('out/build/node_modules'));
  symlinkSync(projectPath('main/lib'), projectPath('out/build/lib'));
  symlinkSync(projectPath('main/package.json'), projectPath('out/build/package.json'));
}

async function buildWeb() {
  // Build the render process Typescript
  const web = projectPath('web');
  const tsc = projectPath('web/node_modules/.bin/tsc');
  await execScript(web, tsc, '--project', 'web_tsconfig.json');

  // Forward static resources and typescript source
  fs.mkdirSync(projectPath('out/build/web/web'), {recursive: true});
  fs.mkdirSync(projectPath('out/build/web/lib'), {recursive: true});

  symlinkSync(projectPath('art/appicon.png'), projectPath('out/build/web/appicon.png'));
  symlinkSync(projectPath('web/lib/js'), projectPath('out/build/web/lib/js'));
  symlinkSync(projectPath('web/lib/images'), projectPath('out/build/web/lib/images'));
  symlinkSync(projectPath('web/src'), projectPath('out/build/web/web/src'));

  // We depend on require.js for module loading in the render process.
  fs.cpSync(projectPath('web/lib/boot/require.js'), projectPath('out/build/web/require.js'));
}

async function buildCss() {
  // Build the SASS into intermediate CSS
  const web = projectPath('web');
  const sass = projectPath('main/node_modules/.bin/sass');
  await execScript(web, sass, 'css:../out/sass');

  // Concatenate all the CSS into one file
  let lines = ['/* ALL COMPILED CSS */'];
  for (const cssPath of listDirR(projectPath('out/sass'))) {
    if (cssPath.toLowerCase().endsWith('.css')) {
      stripSourceMap(cssPath);
      const suffix = cssPath.substring(projectPath('out/sass').length);
      lines.push(`/* ${suffix} */`);
      lines.push('' + fs.readFileSync(cssPath));
    }
  }
  fs.writeFileSync(projectPath('out/build/web/compiled.css'), lines.join('\n'));
}

async function runDev() {
  // Launch the development mode tool
  const p = projectPath('out/build');
  const electron = projectPath('out/build/node_modules/.bin/electron');
  await execScript(p, electron, '.');
}

// Generates ICO and ICNS files from the art/appicon.png file
async function buildIcons() {
  const main = projectPath('main');
  fs.mkdirSync(projectPath('out/build/web'), {recursive: true});

  if (process.platform === 'darwin') {
    const iconz = projectPath('main/node_modules/.bin/iconz');
    const infile = projectPath('art/macos-icon.png');
    await execScript(main, iconz, '-i', infile, `--icns=appicon`);
    fs.renameSync(projectPath('art/appicon.icns'), projectPath('out/build/web/appicon.icns'));
  }

  const png2ico = projectPath('main/node_modules/.bin/png-to-ico');
  const pngfile = projectPath('art/appicon.png');
  const icoData = await execScriptAndGetResult(main, png2ico, pngfile);
  fs.writeFileSync(projectPath('out/build/web/appicon.ico'), icoData);
}

async function packageElectron() {
  fs.cpSync(projectPath('out/build'), projectPath('out/package'), {dereference: false, recursive: true});

  // Replace the lib symlinks with real copies so we can manipulate them
  rmProjectFile('out/package/lib');
  rmProjectFile('out/package/package.json');
  rmProjectFile('out/package/web/lib/js');
  rmProjectFile('out/package/web/lib/images');

  // Place the real files
  fs.cpSync(projectPath('main/package.json'), projectPath('out/package/package.json'));
  fs.cpSync(projectPath('main/lib'), projectPath('out/package/lib'), {dereference: true, recursive: true});
  fs.cpSync(projectPath('web/lib/js'), projectPath('out/package/web/lib/js'), {dereference: true, recursive: true});
  fs.cpSync(projectPath('web/lib/images'), projectPath('out/package/web/lib/images'), {dereference: true, recursive: true});

  // Erase platform-specific assets for the other platforms
  for (const otherPlatform of ['darwin', 'win32', 'linux']) {
    if (otherPlatform != process.platform) {
      rmProjectFile(`out/package/lib/${otherPlatform}`);
      rmProjectFile(`out/package/web/lib/${otherPlatform}`);
      rmProjectFile(`out/package/web/lib/js/${otherPlatform}`);
      rmProjectFile(`out/package/web/lib/images/${otherPlatform}`);
    }
  }

  // Parse project metadata from package.json
  const packageInfo = parsePackageJson();
  const appname = packageInfo.name;
  const appversion = packageInfo.version;
  const arch = process.arch;
  const plat = process.platform;
  const host = packageInfo.updatehost;
  const url = `${host}/${appname}-${plat}-${arch}-updateinfo-${appversion}.json`

  // Put the version info within the app so the updater can use it
  fs.writeFileSync(projectPath('out/package/lib/appversion.txt'), appversion);
  fs.writeFileSync(projectPath('out/package/lib/updateinfo.txt'), url);

  // Run Forge
  fs.cpSync(projectPath('main/darwin_forge.config.js'), projectPath('out/package/forge.config.js'));
  await execScript(projectPath('out/package'), projectPath('out/package/node_modules/.bin/electron-forge'), 'make');

  // Fix NPM afterwards, since Forge prunes away dev dependencies
  await install();

  // Stage the zip
  const zipname = `${appname}-${plat}-${arch}-${appversion}.zip`;
  fs.mkdirSync(projectPath('out/dist'), {recursive: true});
  fs.cpSync(projectPath(`out/package/out/make/zip/${plat}/${arch}/${zipname}`), projectPath(`out/dist/${zipname}`));

  if (process.platform === 'darwin') {
    // Also stage the MacOS app
    await execScript(projectPath('out/dist'), 'unzip', projectPath(`out/dist/${zipname}`));
    console.log(`Run darwin App with: open ${projectPath(`out/dist/${appname}.app`)}`);
  }

    console.log(`Downloadable ${plat} zip : ${projectPath(`out/dist/${zipname}`)}`);
}

function printHelp() {
  console.log(`
Syntax: node ./scripts/builder.js <command>

Where the command is one of:`);
  for (const [command, helpAndSteps] of COMMANDS) {
    console.log(`"${command}": ${helpAndSteps[0]}`);
  }
}
