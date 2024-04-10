#!/bin/node

// This script builds the project to a locally runnable state. Typescript errors are
// emitted, and it sets up symlinks for in-place local running. To package the app
// for distribution, look at ./scripts/package.js instead.

import fs from 'fs';
import {dirname, basename} from 'path';
import {execScript, execNpm, projectPath, runSteps, symlinkSync, listDirR, readTextFileOr,
        execScriptAndGetResult, rmProjectFile, parsePackageJson, stripSourceMap, getSHA256,
        rewriteInPlace} from './_base.js';

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
  ['test', ['Builds the test harness and runs each test',
      buildMain, buildWeb, buildCss, buildTest, runDev]],
  ['package', ['Packages a distributable Electron binary for the current platform',
      cleanOut, buildMain, buildWeb, buildCss, buildIcons, packageElectron]],
  ['help', ['Prints this help message',
      printHelp]],
  ['explain', ['Prints the detailed steps that each command performs',
      printExplain]]
]);

const EXPLAIN = new Map([
  [cleanOut, 'Erases all build and package output'],
  [cleanNpm, 'Erases all node_modules so they can be npm installed again'],
  [install, 'Performs NPM install on both main and render process sub-modules'],
  [buildMain, 'Build typescript and electron dependencies for the main process'],
  [buildWeb, 'Builds typescript into compiled.js and electron dependencies for the render process'],
  [buildCss, 'Builds the CSS into compiled.css'],
  [runDev, 'Quickly launches the Electron app in development mode (pre-packaged)'],
  [buildIcons, 'Generates app icons for the current platform.'],
  [packageElectron, 'Packages a distributable Electron binary for the current platform.'],
  [buildTest, 'Builds all typescript for main and test, including test code'],
  [printHelp, 'Shows a brief description of each command'],
  [printExplain, 'Shows this help message'],
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

  // This will be mutated by the test script so we make a copy of it
  fs.cpSync(projectPath('web/lib/boot/electronmain.html'), projectPath('out/build/web/electronmain.html'));
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
  const {name, version, updatehost} = packageInfo;
  const {arch, platform} = process;
  const updateUrl = `${updatehost}/${name}-${platform}-${arch}-updateinfo-${version}.json`

  // Put the version info within the app so the updater can use it
  fs.writeFileSync(projectPath('out/package/lib/appversion.txt'), version);
  fs.writeFileSync(projectPath('out/package/lib/updateinfo.txt'), updateUrl);

  // Run Forge
  fs.cpSync(projectPath('main/darwin_forge.config.js'), projectPath('out/package/forge.config.js'));
  await execScript(projectPath('out/package'), projectPath('out/package/node_modules/.bin/electron-forge'), 'make');

  // Fix NPM afterwards, since Forge prunes away dev dependencies
  await install();

  // Stage all the output
  fs.mkdirSync(projectPath('out/dist'), {recursive: true});
  if (process.platform === 'win32') {
    await stageWin32(packageInfo);
  } else {
    await stage(packageInfo);
  }
}

// Emits the updateinfo.json file which, once on a web server, will make the app update itself.
async function stage(packageInfo) {
  const {name, version, previousversion, updatehost} = packageInfo;
  const {arch, platform} = process;

  // Stage the zip
  const zipname = `${name}-${platform}-${arch}-${version}.zip`;
  const zipfile = projectPath(`out/dist/${zipname}`);
  fs.renameSync(projectPath(`out/package/out/make/zip/${platform}/${arch}/${zipname}`), zipfile);

  const sha256 = getSHA256(zipfile);
  const url = `${updatehost}/${zipname}`;

  const updateJsonFile = projectPath(`out/dist/${name}-${platform}-${arch}-updateinfo-${previousversion}.json`);
  fs.writeFileSync(updateJsonFile, JSON.stringify({url, sha256, release: ''}, null, 2));

  if (process.platform === 'darwin') {
    // Also stage the MacOS app for local execution
    await execScript(projectPath('out/dist'), 'unzip', zipfile);
    console.log(`Run darwin App with: open ${projectPath(`out/dist/${name}.app`)}`);
  }

  console.log(`Update info prepared, roll out updates by publishing:`);
  console.log('ZIP : ' + zipfile);
  console.log('JSON: ' + updateJsonFile);
  console.log('Host: ' + updatehost);
}

// Same as above but with the extra nupkg scheme stuff
async function stageWin32(packageInfo) {

  // TODO - this isn't quite right, test and fix

  const {name, version, previousversion, updatehost} = packageInfo;
  const {arch, platform} = process;

  const sqPath = projectPath('out/package/out/make/squirrel.windows/x64');
  const nupkgOrig = `${name}-${version}-full.nupkg`;
  const nupkg = `${name}-win32-x64-${version}.nupkg`;
  const zipfile = `${name}-win32-x64-${version}-installer.zip`;
  const setupfile = sqPath + `/${name}-${version} Setup.exe`;

  // Place the nupkg file
  fs.renameSync(`${sqPath}/${nupkgOrig}`, projectPath(`out/dist/${nupkg}`));

  // Zip the installer exe
  fs.rmSync(projectPath(`out/dist/${zipfile}`), {force: true});
  await execScript(projectPath('.'), 'powershell', '-Command',
      `& {Compress-Archive -Path '${setupfile}' -DestinationPath out/dist/${zipfile}}`);

  // Create the update info file, which old apps in the wild will download
  const url = `${updatehost}/${name}-${platform}-${arch}-updateinfo-${version}.json`;
  const sha256 = getSHA256(projectPath(`out/dist/${nupkg}`));
  const release = readTextFileOr(`${sqPath}/RELEASES`);

  const updateJsonFile = projectPath(`out/dist/${name}-win32-x64-updateinfo-${previousversion}.json`);
  fs.writeFileSync(updateJsonFile, JSON.stringify({url, sha256, release}, null, 2));
  console.log(`Run Winstaller locally with: ${projectPath(`out/make/squirrel.windows/${arch}/${appname}-${appversion} Setup.exe`)}`);
  console.log(`Update info prepared, roll out updates by publishing these:`);
  console.log(`Install ZIP: ${projectPath(`out/dist/${zipfile}`)}`);
  console.log('Update JSON: ' + updateJsonFile);
  console.log('Update NPKG: ' + projectPath(`out/dist/${nupkg}`));
  console.log('Host URL   : ' + updatehost);
}

// Builds the main process code with the testing harness installed
async function buildTest() {
  // Replace the compiled typescript with our versions
  const test = projectPath('test');
  const tsc = projectPath('main/node_modules/.bin/tsc');
  await execScript(test, tsc, '--project', 'testmain_tsconfig.json');
  await execScript(test, tsc, '--project', 'testweb_tsconfig.json');

  // Find all the tests and register them
  const webTestNames = [];
  const mainTestNames = [];
  const root = projectPath('test');
  for (const tsFile of listDirR(projectPath('test/src'))) {
    if (tsFile.endsWith('.ts') && basename(tsFile).startsWith('test_')) {
      const name = 'test' + tsFile.substring(root.length, tsFile.length - 3);
      mainTestNames.push(name);
    }
  }
  for (const tsFile of listDirR(projectPath('test/websrc'))) {
    if (tsFile.endsWith('.ts') && basename(tsFile).startsWith('test_')) {
      const name = 'test' + tsFile.substring(root.length, tsFile.length - 3);
      webTestNames.push(name);
    }
  }

  // inject lib/electronmain.inject.html, as well as require statements for all the node-side tests
  const htmlTemplateText = fs.readFileSync(projectPath('test/lib/electronmain.inject.html'));
  rewriteInPlace(projectPath('out/build/web/electronmain.html'),
      /<!--__TEST_DRIVER_INJECTION_POINT__-->/g,
      `
      <script>
      require(${JSON.stringify(webTestNames)});
      require(["test/websrc/webrunner"]);
      </script>
      ${htmlTemplateText}
      `);

  // inject lib/electronmain.inject.js into the Javascript, and include the Runner class
  const jsTemplateText = fs.readFileSync(projectPath('test/lib/electronmain.inject.js'));
  rewriteInPlace(projectPath('out/build/electronmain.js'),
      /\/\/ __TEST_DRIVER_INJECTION_POINT__/g,
      `
      ${jsTemplateText}
      require('./test/runner.js');
      `);

  // rewrite require() paths for the test code, and then move it into place
  for (const jsFile of listDirR(projectPath('out/testtsc/test/src'))) {
    if (jsFile.endsWith('.js')) {
      // Example line: \nconst logger_1 = require("../../main/src/logger");\n
      rewriteInPlace(jsFile, /(\nconst.*? = require\("\.\.)\/\.\.\/main\/src(.*"\);\n)/g, '$1$2');
    } else if (jsFile.endsWith('.js.map')) {
      // Example phrase: "sources":["../../../../test/src/test_start.ts"]
      rewriteInPlace(jsFile, /"sources":\["..\/..\/..\/..\/test\/src\//g, '"sources":["../../../test/src/');
    }
  }
  fs.renameSync(projectPath('out/testtsc/test/src'), projectPath('out/build/test'));

  // Place a symlink to the test lib directory, so we don't have to copy it
  symlinkSync(projectPath('test/lib'), projectPath('out/build/test/lib'));
}

function printHelp() {
  console.log(`
Syntax: node ./scripts/builder.js <command>

Where the command is one of:`);
  for (const [command, helpAndSteps] of COMMANDS) {
    console.log(`"${command}": ${helpAndSteps[0]}`);
  }
}

function printExplain() {
  console.log(`
Syntax: node ./scripts/builder.js <command>

Here are the commands in detail:`);
  for (const [command, helpAndSteps] of COMMANDS) {
    console.log(`${command}: ${helpAndSteps[0]}`);
    for (const step of helpAndSteps.slice(1)) {
      console.log(`  - ${EXPLAIN.get(step)}`);
    }
    console.log('');
  }
}
