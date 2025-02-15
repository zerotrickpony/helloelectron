#!/bin/node

// This script builds the project to a locally runnable state. Typescript errors are
// emitted, and it sets up symlinks for in-place local running. Multi-commands provided
// for packaging and testing. See README.md and the help output.


import fs from 'fs';
import { basename, dirname } from 'path';
import { compareMtime, execNpm, execNpmAndGetResult, execScript, projectPathExists, execScriptAndGetResult, getHighestMtime, getHighestTSCMtime, getSHA256, listDirR, parseJson, parseProjectJson, parseSecrets, projectPath, readTextFileOr, rewriteInPlace, rmProjectFile, runSteps, sleep, stripSourceMap, symlinkSync } from './_base.js';

const COMMANDS = new Map([
  ['setup', ['First time installation and build',
      checkVersions, cleanOut, cleanNpm, install, buildMain, buildWeb, buildCss]],
  ['install', ['Just does NPM install',
      checkVersions, install]],
  ['clean', ['Erases all build output',
      cleanOut]],
  ['veryclean', ['Erases all build output and NPM packages',
      cleanOut, cleanNpm]],
  ['build', ['Builds the electron project for development mode',
      setLock, buildMain, buildWeb, buildCss]],
  ['icons', ['Generates the icon files the packaged Electron app',
      setLock, buildIcons]],
  ['lint', ['Runs eslint on the codebase',
      setLock, buildMain, buildWeb, buildCss, lint, removeLock]],
  ['run', ['Builds and runs the Electron app in development mode',
      cleanIfTest, setLock, buildMain, buildWeb, buildCss, removeLock, runDev]],
  ['checkdeps', ['Checks for circular dependencies in the typescript.',
      checkDeps]],
  ['test', ['Builds the test harness and runs each test',
      setLock, buildMain, buildWeb, buildCss, buildTest, removeLock, checkDeps, lint, runTests]],
  ['help', ['Prints this help message',
      printHelp]],
  ['explain', ['Prints the detailed steps that each command performs',
      printExplain]],

  // Packaging / release / distribution stuff
  ['package', ['Packages a distributable Electron binary for the current platform',
      setLock, cleanOut, buildMain, buildWeb, buildCss, checkDeps, buildIcons, packageElectron]],
  ['notarize', ['(MacOS only) runs notarytool and creates signatures. Only do this right after package',
      notarizeDarwin]],
  ['notarizex64', ['(MacOS only) runs notarytool on a supplied x64 app expected in out/dist',
      notarizeDarwinX64]],
  ['packagesource', ['Packages buildable source tarball for Linux',
      cleanOut, packageSrc]],

  // Combo helpers
  ['cleanbuild', ['Same as "clean" and then "build"',
      cleanOut, setLock, buildMain, buildWeb, buildCss]],
  ['cleanrun', ['Same as "clean" and then "run"',
      cleanOut, setLock, buildMain, buildWeb, buildCss, removeLock, runDev]],

  // Partial commands for incremental build; these are faster but don't ensure a consistent build.
  ['buildmain', ['Builds the electron project for development mode',
      setLock, buildMain, buildWeb, buildCss]],
  ['web', ['Builds just the render process Typescript and CSS',
      setLock, buildWeb, buildCss]],
  ['css', ['Builds just the CSS',
      setLock, buildCss]],
  ['justrun', ['Runs the electron app without building it.',
      runDev]],
  ['buildtest', ['Builds just the test code, assuming the rest of the project is already built',
      setLock, buildTest]],
  ['justtest', ['Runs the test harness again without rebuilding it.',
      runTests]],
  ['testone', ['Builds the test harness and runs one test',
      setLock, buildMain, buildWeb, buildCss, buildTest, removeLock, runOneTest]],
  ['retest', ['Builds the test harness and reruns the given test, and then all tests after it',
      setLock, buildMain, buildWeb, buildCss, buildTest, removeLock, reTest]],
  ['justtestone', ['Builds the test harness and runs one test',
      runOneTest]],
]);

const EXPLAIN = new Map([
  [cleanOut, 'Erases all build and package output'],
  [cleanNpm, 'Erases all node_modules so they can be npm installed again'],
  [checkVersions, 'Checks the tool versions of Python, Node, and NPM'],
  [install, 'Performs NPM install on both main and render process sub-modules'],
  [buildMain, 'Build typescript and electron dependencies for the main process'],
  [buildWeb, 'Builds typescript into compiled.js and electron dependencies for the render process'],
  [buildCss, 'Builds the CSS into compiled.css'],
  [runDev, 'Quickly launches the Electron app in development mode (pre-packaged)'],
  [buildIcons, 'Generates app icons for the current platform.'],
  [packageElectron, 'Packages a distributable Electron binary for the current platform.'],
  [buildTest, 'Builds all typescript for main and test, including test code'],
  [checkDeps, 'Checks the codebase for circular module dependencies'],
  [runTests, 'Runs every test_blah.ts file and stops if any of them fail'],
  [runOneTest, 'Runs the given test_blah.ts file'],
  [reTest, 'Re-runs the test suite starting from the given test, instead of from the beginning'],
  [setLock, 'Creates a lockfile to prevent other builds from running concurrently.'],
  [removeLock, 'Removes the build lockfile.'],
  [notarizeDarwin, '(MacOS only) runs notarytool on the packaged app'],
  [printHelp, 'Shows a brief description of each command'],
  [printExplain, 'Shows this help message'],
]);

// Returns the command and any arguments after it, as an array.
function parseArgs() {
  let idx = 0;
  for (idx = 0; idx < process.argv.length; idx++) {
    if (process.argv[idx].endsWith('builder.js')) {
      break;
    }
  }
  if (idx >= process.argv.length - 1) {
    // No command argument specified
    return {args: [], steps: COMMANDS.get('build').slice(1)};
  }

  const command = process.argv[idx + 1];
  const args = [...process.argv.slice(idx + 2)];
  const commands = COMMANDS.get(command.toLowerCase());
  if (!commands) {
    return {args: [], steps: COMMANDS.get('help').slice(1)};
  } else {
    return {args, steps: commands.slice(1)};
  }
}

await runSteps(async x => {
  const {args, steps} = parseArgs();
  for (const step of steps) {
    await step(...args);
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
  fs.rmSync(projectPath('test/node_modules'), {recursive: true, force: true});
}

// Checks if the output folder was last used by the test build, and cleans if so
async function cleanIfTest() {
  if (projectPathExists('out/build/test')) {
    await cleanOut();
  }
}

// NPM install
async function install() {
  await execNpm(projectPath('main'), 'install');
  await execNpm(projectPath('web'), 'install');
  await execNpm(projectPath('test'), 'install');

  if (process.platform == 'darwin') {
    // This thing only works on Mac; we use it during icon generation
    await execNpm(projectPath('main'), 'install', '--no-save', 'iconz@0.3.9');
  }

  // This seems to be needed for SQLite and other native NPM modules
  await execScript(projectPath('main'), projectPath('main/node_modules/.bin/electron-rebuild'));
}

// Builds the main process code
async function buildMain() {
  const main = projectPath('main');
  const touchfile = projectPath('out/tscdone_main.touch');

  if (!checkTscDone(touchfile, 'main/main_tsconfig.json')) {
    // Build the main process Typescript
    const tsc = projectPath('main/node_modules/.bin/tsc');
    await execScript(main, tsc, '--project', 'main_tsconfig.json');
    fs.writeFileSync(touchfile, 'tsc run for component: main');
  }

  // The source map for electronpreload.ts can never work because it's unservable
  stripSourceMap(projectPath('out/build/electronpreload.js'));

  // Forward node_modules into the build directory using symlinks
  symlinkSync(projectPath('main/node_modules'), projectPath('out/build/node_modules'));
  symlinkSync(projectPath('main/lib'), projectPath('out/build/lib'));
  symlinkSync(projectPath('main/package.json'), projectPath('out/build/package.json'));
}

async function buildWeb() {
  const web = projectPath('web');
  const touchfile = projectPath('out/tscdone_web.touch');

  if (!checkTscDone(touchfile, 'web/web_tsconfig.json')) {
    // Build the render process Typescript
    const tsc = projectPath('web/node_modules/.bin/tsc');
    await execScript(web, tsc, '--project', 'web_tsconfig.json');
    fs.writeFileSync(touchfile, 'tsc run for component: web');
  }

  // Forward static resources and typescript source
  fs.mkdirSync(projectPath('out/build/web/web'), {recursive: true});
  fs.mkdirSync(projectPath('out/build/web/main/src'), {recursive: true});
  fs.mkdirSync(projectPath('out/build/web/lib'), {recursive: true});

  if (process.platform !== 'win32') {
    symlinkSync(projectPath('art/appicon.png'), projectPath('out/build/web/appicon.png'));
  } else {
    fs.cpSync(projectPath('art/appicon.png'), projectPath('out/build/web/appicon.png'));  // windows refuses to read symlink icons
  }
  symlinkSync(projectPath('web/lib/js'), projectPath('out/build/web/lib/js'));
  symlinkSync(projectPath('web/lib/images'), projectPath('out/build/web/lib/images'));
  symlinkSync(projectPath('web/src'), projectPath('out/build/web/web/src'));
  symlinkSync(projectPath('main/src/common'), projectPath('out/build/web/main/src/common'));

  // We depend on require.js for module loading in the render process.
  fs.cpSync(projectPath('web/lib/boot/require.js'), projectPath('out/build/web/require.js'));

  // This will be mutated by the test script so we make a copy of it
  fs.cpSync(projectPath('web/lib/boot/electronmain.html'), projectPath('out/build/web/electronmain.html'));
}

// Returns true if the touchfile is newer than all of the TS files and config files.
function checkTscDone(touchfile, tsconfig) {
  const touchtime = getHighestMtime(touchfile);
  if (!touchtime) {
    return false;  // no sentinel file, so tsc is definitely needed
  }
  const srctime = getHighestTSCMtime(tsconfig);
  if (!srctime) {
    console.log(`WARNING: No sources parsed from tsc check, performing normal build`);
    return false;  // no sources parsed
  }
  return (srctime < touchtime);
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

// Runs eslint on all packages.
async function lint() {
  await execESLint('main/main_tsconfig.json', '**/*.ts');
  await execESLint('web/web_tsconfig.json', '../web/src/**/*.ts');
  await execESLint('test/testmain_tsconfig.json', '../test/src/**/*.ts');
  await execESLint('test/testweb_tsconfig.json', '../test/websrc/**/*.ts');
}

async function execESLint(tsconfigProjectPath, globFromMain) {
  const main = projectPath('main');
  const eslint = projectPath('main/node_modules/.bin/eslint');
  await execScript(main, eslint, '--no-eslintrc', '-c', './eslint.config.cjs',
      '--parser-options', `project:"${projectPath(tsconfigProjectPath)}"`, globFromMain);
}

// Waits for any live pid to finish, and then writes a pid lockfile for the current builder.
async function setLock() {
  let didMessage = false;
  const lockpath = 'out/pid.lockfile';
  let lock = parseProjectJson(lockpath);
  while (lock && lock.pid) {
    try {
      // Another build may be running, wait for it if it's still live
      process.kill(lock.pid, 0);
    } catch (e) {
      // The pid does not exist, clear the lockfile
      rmProjectFile(lockpath);
      break;
    }

    // It's still alive, try waiting for it and then go again
    if (!didMessage) {
      console.log(`Waiting for concurrent build to finish...`);
      didMessage = true;
    }
    await sleep(500);
    lock = parseProjectJson(lockpath);
  }

  // Set our own lockfile
  fs.mkdirSync(projectPath('out'), {recursive: true});
  fs.writeFileSync(projectPath(lockpath), JSON.stringify({pid: process.pid}));
}

function removeLock() {
  rmProjectFile('out/pid.lockfile');
}

async function runDev(...args) {
  // Launch the development mode tool
  const p = projectPath('out/build');
  const electron = projectPath('out/build/node_modules/.bin/electron');
  await execScript(p, electron, '.', ...args);
}

async function checkVersions() {
  const main = projectPath('main');
  const packageInfo = parseJson(projectPath('main/package.json'), true);
  const {expectnpmversion, expectpythonversion, expectnodeversion} = packageInfo;

  if (expectnodeversion) {
    const nodeVersion = (await execScriptAndGetResult(main, 'node', '--version')).toString().trim();
    if (nodeVersion != expectnodeversion) {
      console.error(`ERROR: package.json expectnodeversion specifies ${expectnodeversion}, but found ${nodeVersion}`);
      process.exit(1);
    }
  }

  if (expectnpmversion) {
    const npmVersion = (await execNpmAndGetResult(main, '--version')).toString().trim();
    if (npmVersion != expectnpmversion) {
      console.error(`ERROR: package.json expectnpmversion specifies ${expectnpmversion}, but found ${npmVersion}`);
      process.exit(1);
    }
  }

  if (expectpythonversion) {
    const pythonVersion = (await execScriptAndGetResult(main, 'python3', '--version')).toString().trim();
    if (pythonVersion != expectpythonversion) {
      console.error(`ERROR: package.json expectpythonversion specifies ${expectpythonversion}, but found ${pythonVersion}`);
      process.exit(1);
    }
  }
}

async function checkDeps() {
  const web = projectPath('web');
  const main = projectPath('main');
  const dpdm = projectPath('web/node_modules/.bin/dpdm');
  const maindepsfile = projectPath('out/deps/maindeps.json');
  const webdepsfile = projectPath('out/deps/webdeps.json');
  await execScript(main, dpdm, '-T', '--progress=false', `--output=${maindepsfile}`, 'src/electronmain.ts');
  await execScript(web, dpdm, '-T', '--progress=false', `--output=${webdepsfile}`, 'src/app.ts');

  // If these files have a "circular" block then there were circular dependencies
  const mainerrors = parseJson(maindepsfile, true).circulars;
  const weberrors = parseJson(webdepsfile, true).circulars;
  const hasErrors = mainerrors.length > 0 || weberrors.length > 0;
  if (mainerrors.length > 0) {
    console.error(`ERROR: ${mainerrors.length} circular dep(s) in main/src: see above (or ${maindepsfile}) for further details.`);
  }
  if (weberrors.length > 0) {
    console.error(`ERROR: ${weberrors.length} circular dep(s) in main/src: see above (or ${webdepsfile}) for further details.`);
  }
  if (hasErrors) {
    process.exit(1);
  }
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

  // Replace the lib symlinks with real copies, because we'll need to manipulate them and
  // because the packagers don't like symlinks
  rmProjectFile('out/package/lib');
  rmProjectFile('out/package/package.json');
  rmProjectFile('out/package/web/lib/js');
  rmProjectFile('out/package/web/lib/images');
  rmProjectFile('out/package/node_modules');
  rmProjectFile('out/package/web/appicon.png');
  rmProjectFile('out/package/web/src');
  rmProjectFile('out/package/web/web/src');
  rmProjectFile('out/package/web/main/src/common');

  // Place the real files
  fs.cpSync(projectPath('main/package.json'), projectPath('out/package/package.json'));
  fs.cpSync(projectPath('main/lib'), projectPath('out/package/lib'), {dereference: true, recursive: true});
  fs.cpSync(projectPath('web/lib/js'), projectPath('out/package/web/lib/js'), {dereference: true, recursive: true});
  fs.cpSync(projectPath('web/lib/images'), projectPath('out/package/web/lib/images'), {dereference: true, recursive: true});
  fs.cpSync(projectPath('main/node_modules'), projectPath('out/package/node_modules'), {dereference: false, recursive: true});
  fs.cpSync(projectPath('art/appicon.png'), projectPath('out/package/web/appicon.png'));
  fs.cpSync(projectPath('web/src'), projectPath('out/package/web/src'), {dereference: false, recursive: true});
  fs.cpSync(projectPath('main/src/common'), projectPath('out/package/web/main/src/common'), {dereference: false, recursive: true});
  fs.cpSync(projectPath('web/src'), projectPath('out/package/web/web/src'), {dereference: false, recursive: true});

  // Place a copy of the node-side source, this isn't used its just for reference
  fs.mkdirSync(projectPath('out/package/main-src'), {recursive: true});
  fs.cpSync(projectPath('main/src'), projectPath('out/package/main-src'), {dereference: false, recursive: true});

  // Erase platform-specific and arch-specific assets if they're not relevant to the current package
  for (const otherPlatform of ['darwin', 'win32', 'linux']) {
    if (otherPlatform != process.platform) {
      rmProjectFile(`out/package/lib/${otherPlatform}`);
      rmProjectFile(`out/package/web/lib/${otherPlatform}`);
      rmProjectFile(`out/package/web/lib/js/${otherPlatform}`);
      rmProjectFile(`out/package/web/lib/images/${otherPlatform}`);
    }
  }
  for (const otherArch of ['x64', 'arm64']) {
    if (otherArch != process.arch) {
      rmProjectFile(`out/package/lib/${process.platform}/${otherArch}`);
      rmProjectFile(`out/package/web/lib/${process.platform}/${otherArch}`);
      rmProjectFile(`out/package/web/lib/js/${process.platform}/${otherArch}`);
      rmProjectFile(`out/package/web/lib/images/${process.platform}/${otherArch}`);
    }
  }

  // Parse project metadata from package.json
  const packageInfo = parseJson(projectPath('main/package.json'), true);
  const {name, version, updatehost} = packageInfo;
  const {arch, platform} = process;
  const updateUrl = `${updatehost}/${name}-${platform}-${arch}-updateinfo-${version}.json`;
  requireValue(name, 'Missing name property in main/package.json');
  requireValue(version, 'Missing version property in main/package.json');
  requireValue(updatehost, 'Missing updatehost property in main/package.json');

  // Put the version info within the app so the updater can use it
  fs.writeFileSync(projectPath('out/package/lib/appversion.txt'), version);
  fs.writeFileSync(projectPath('out/package/lib/updateinfo.txt'), updateUrl);

  // Run Forge
  fs.cpSync(projectPath(`main/${platform}_forge.config.js`), projectPath('out/package/forge.config.js'));
  await execScript(projectPath('out/package'), projectPath('out/package/node_modules/.bin/electron-forge'), 'make');

  // Stage all the output
  fs.mkdirSync(projectPath('out/dist'), {recursive: true});
  if (process.platform === 'darwin') {
    await stageDarwin(packageInfo);
  } else if (process.platform === 'win32') {
    await stageWin32(packageInfo);
  } else {
    await stageLinux(packageInfo);
  }
}

// Simply unzips the foo.app package.
async function stageDarwin(packageInfo) {
  const {name, version} = packageInfo;
  const {arch, platform} = process;

  // Extract the app, since a zip file of unsigned code is useless for distribution anyway
  const zipname = `${name}-${platform}-${arch}-${version}.zip`;
  const zipsrc = projectPath(`out/package/out/make/zip/${platform}/${arch}/${zipname}`);
  await execScript(projectPath('out/dist'), 'unzip', zipsrc);
  fs.rmSync(zipsrc);
  console.log(`Packaged: open ${projectPath(`out/dist/${name}.app`)}`);
}

// Emits the updateinfo.json file and signs and notarizes the zip. Put these on a web server to make the app update itself.
async function notarizeDarwin(opt_platforminfo) {
  const packageInfo = parseJson(projectPath('main/package.json'), true);
  const {name, version, updatehost, previousversion} = packageInfo;
  const {arch, platform} = opt_platforminfo ? opt_platforminfo : process;
  const {notarytoolPassword, appleDeveloperId, appleTeamId, appleSignature} = parseSecrets();
  const {signTargets} = parseProjectJson('main/lib/darwin/signing.json', true);

  requireValue(previousversion, 'Missing previousversion property in main/package.json');
  requireValue(notarytoolPassword, `Missing notarytoolPassword property in ${secretsPath()}`);
  requireValue(appleDeveloperId, `Missing appleDeveloperId property in ${secretsPath()}`);
  requireValue(appleTeamId, `Missing appleTeamId property in ${secretsPath()}`);
  requireValue(appleSignature, `Missing appleSignature property in ${secretsPath()}`);

  // Sign
  let signCount = 0;
  const entitlementsFile = projectPath('main/lib/darwin/entitlements.plist');
  for (const path of signTargets) {
    if (compareMtime(0, projectPath(path)) > 0) {
      signCount++;
      await execScript(projectPath('out/dist'), 'codesign', '--sign', appleSignature,
          '--deep', '--force', '--timestamp', '--options', 'runtime', '--entitlements', entitlementsFile, projectPath(path));
    }
  }
  if (signCount < 1) {
    console.error(`Error: No signing targets exist, did you forget to package? (targets listed in main/lib/darwin/signing.json)`);
    throw new Error('STOP_BUILD');
  }

  // notarytool requires a single zip submission
  const zipname = `${name}-${platform}-${arch}-${version}.zip`;
  await execScript(projectPath('out/dist'), 'zip', '-y', '-r', zipname, `${name}.app`);

  // Upload the zip to Apple and wait for the result
  await execScript(projectPath('out/dist'), 'xcrun', 'notarytool', 'submit', '--apple-id', appleDeveloperId, '--team-id',
      appleTeamId, '--password', notarytoolPassword, '--wait', '-v', projectPath(`out/dist/${zipname}`));
  await execScript(projectPath('out/dist'), 'xcrun', 'stapler', 'staple', `${name}.app`);

  // Recreate the zip now that the app is stapled.
  rmProjectFile(`out/dist/${zipname}`);
  await execScript(projectPath('out/dist'), 'zip', '-y', '-r', zipname, `${name}.app`);

  // Create the updateinfo JSON
  const sha256 = getSHA256(projectPath(`out/dist/${zipname}`));
  const url = `${updatehost}/${zipname}`;
  const updateJsonFile = projectPath(`out/dist/${name}-${platform}-${arch}-updateinfo-${previousversion}.json`);
  fs.writeFileSync(updateJsonFile, JSON.stringify({url, sha256, release: ''}, null, 2));

  // Also stage the MacOS app for local execution
  console.log(`Update info prepared, roll out updates by publishing:`);
  console.log('ZIP  : ' + projectPath(`out/dist/${zipname}`));
  console.log('JSON : ' + updateJsonFile);
  console.log('Host : ' + updatehost);
}

async function notarizeDarwinX64() {
  await notarizeDarwin({arch: 'x64', platform: 'darwin'});
}

// Emits the .deb file. Auto-update is not supported on Linux so no JSON stuff.
async function stageLinux(packageInfo) {
  const {name, version} = packageInfo;
  const debname = `${name}_${version}_amd64.deb`;
  const debfile = projectPath(`out/dist/${debname}`);
  fs.renameSync(projectPath(`out/package/out/make/deb/x64/${debname}`), debfile);
  console.log('DEB prepared: ' + debfile);
}

// Same as above but with the extra nupkg scheme stuff
async function stageWin32(packageInfo) {
  const {name, version, previousversion, updatehost} = packageInfo;
  const {arch, platform} = process;
  requireValue(previousversion, 'Missing previousversion property in main/package.json');

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
  console.log(`Run Winstaller locally with: ${setupfile}`);
  console.log(`Update info prepared, roll out updates by publishing these:`);
  console.log(`Install ZIP: ${projectPath(`out/dist/${zipfile}`)}`);
  console.log('Update JSON: ' + updateJsonFile);
  console.log('Update NPKG: ' + projectPath(`out/dist/${nupkg}`));
  console.log('Host URL   : ' + updatehost);
}

// Creates a tarball of a subset of the source code, enough to build on an unseen linux platform.
async function packageSrc() {
  const packageInfo = parseJson(projectPath('main/package.json'), true);
  const {name, version} = packageInfo;
  requireValue(name, 'Missing name property in main/package.json');
  requireValue(version, 'Missing version property in main/package.json');

  const out = `out/package/srctar/${name}`;
  const platform = 'linux';
  const arch = 'x64';

  const SRC_LIST = [
    'scripts/_base.js',
    'scripts/builder.js',
    'scripts/package.json',
    'art/appicon.png',
    'art/appicon.ico',
    'main/lib',
    'main/src',
    'main/package.json',
    'main/package-lock.json',
    'main/linux_forge.config.js',
    'main/main_tsconfig.json',
    'test/package.json',
    'web/css',
    'web/lib',
    'web/src',
    'web/package.json',
    'web/package-lock.json',
    'web/web_tsconfig.json',
  ];

  // Place the source code itself, not build products
  fs.mkdirSync(projectPath(`${out}`), {recursive: true});
  for (const item of SRC_LIST) {
    const targetPath = `${out}/${item}`;
    fs.mkdirSync(dirname(projectPath(targetPath)), {recursive: true});
    fs.cpSync(projectPath(item), projectPath(targetPath), {dereference: true, recursive: true});
  }

  // Erase platform-specific and arch-specific assets not relevant to linux x64
  for (const otherPlatform of ['darwin', 'win32', 'linux']) {
    if (otherPlatform != platform) {
      rmProjectFile(`${out}/main/lib/${otherPlatform}`);
      rmProjectFile(`${out}/web/lib/${otherPlatform}`);
      rmProjectFile(`${out}/web/lib/js/${otherPlatform}`);
      rmProjectFile(`${out}/web/lib/images/${otherPlatform}`);
    }
  }
  for (const otherArch of ['x64', 'arm64']) {
    if (otherArch != arch) {
      rmProjectFile(`${out}/main/lib/${platform}/${otherArch}`);
      rmProjectFile(`${out}/web/lib/${platform}/${otherArch}`);
      rmProjectFile(`${out}/web/lib/js/${platform}/${otherArch}`);
      rmProjectFile(`${out}/web/lib/images/${platform}/${otherArch}`);
    }
  }

  // Place some build scripts and instructions
  fs.cpSync(projectPath('scripts/linux_srctar_build.sh'), projectPath(`${out}/build.sh`));
  fs.cpSync(projectPath('scripts/linux_srctar_run.sh'), projectPath(`${out}/run.sh`));
  fs.cpSync(projectPath('scripts/linux_srctar_README'), projectPath(`${out}/README`));

  // Make a tarball
  const tarname = `${name}-src-${platform}-${arch}-${version}.tgz`;
  fs.mkdirSync(projectPath('out/dist'), {recursive: true});
  await execScript(projectPath('out/package/srctar'), 'tar', '-zcvf', projectPath(`out/dist/${tarname}`), `./${name}`);

  console.log('Source tarball: ' + projectPath(`out/dist/${tarname}`));
}

// Builds the main process code with the testing harness installed
async function buildTest() {
  // NOTE: tsc could probably be short-circuited but since we modify the source in place
  // it makes it complicated to detect and re-run the right parts of the test build.
  // Replace the compiled typescript with our versions
  const test = projectPath('test');
  const tsc = projectPath('main/node_modules/.bin/tsc');
  await execScript(test, tsc, '--project', 'testmain_tsconfig.json');
  await execScript(test, tsc, '--project', 'testweb_tsconfig.json');

  // Find all the tests and register them
  const webTests = findTestNames_('test/websrc');
  const mainTests = findTestNames_('test/src');
  const webTestPaths = webTests.map(f => `test/websrc/${f}`);
  const mainTestRequires = mainTests.map(t => `    require('./test/${t}.js');`).join('\n');

  // Complain if the tests don't all have unique names
  checkUnique_([...webTests, ...mainTests]);

  // inject lib/electronmain.inject.html, as well as require statements for all the node-side tests
  const htmlTemplateText = fs.readFileSync(projectPath('test/lib/electronmain.inject.html'));
  rewriteInPlace(projectPath('out/build/web/electronmain.html'),
      /<!--__TEST_DRIVER_INJECTION_POINT__-->/g,
      `
      <script>
      require(${JSON.stringify(webTestPaths)});
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
      ${mainTestRequires}
      require('./test/runner.js');
      `);

  // rewrite require() paths for the test code so that we can reparent it into the app
  for (const jsFile of listDirR(projectPath('out/testtsc/test/src'))) {
    if (jsFile.endsWith('.js')) {
      // Example line: \nconst logger_1 = require("../../main/src/logger");\n
      rewriteInPlace(jsFile, /(\nconst.*? = require\("\.\.)\/\.\.\/main\/src(.*"\);)/g, '$1$2');
    } else if (jsFile.endsWith('.js.map')) {
      // Example phrase: "sources":["../../../../test/src/test_start.ts"]
      rewriteInPlace(jsFile, /"sources":\["..\/..\/..\/..\/test\/src\//g, '"sources":["../../../test/src/');
    }
  }

  // place the test code within the built app
  fs.rmSync(projectPath('out/build/test'), {recursive: true, force: true});
  fs.renameSync(projectPath('out/testtsc/test/src'), projectPath('out/build/test'));

  // Place a symlink to the test lib directory, so we don't have to copy it
  symlinkSync(projectPath('test/lib'), projectPath('out/build/test/lib'));

  // Forward the typescript source
  fs.mkdirSync(projectPath('out/build/web/test'), {recursive: true});
  symlinkSync(projectPath('test/websrc'), projectPath('out/build/web/test/websrc'));
}

function checkUnique_(testNames) {
  const seen = new Set();
  for (const name of testNames) {
    if (seen.has(name)) {
      console.error(`ERROR: Multiple tests with the name "${name}", please use unique test names`);
      process.exit(1);
    }
    seen.add(name);
  }
}

function requireValue(v, message) {
  if (!v) {
    throw new Error(message);
  }
}

// Returns the list of test_blah names within the given directory.
function findTestNames_(ppath, opt_specificTest, opt_retest) {
  const result = [];
  const root = projectPath(ppath);
  for (const tsFile of listDirR(root)) {
    const bname = basename(tsFile);
    if (tsFile.endsWith('.ts') && bname.startsWith('test_')) {
      result.push(bname.substring(0, bname.length - 3));
    }
  }
  if (opt_specificTest && opt_retest) {
    // We want this specific test if we have it, plus all tests after it
    const idx = result.indexOf(opt_specificTest);
    return idx == -1 ? [] : result.slice(idx);
  } else if (opt_specificTest) {
    // Just one test
    if (result.indexOf(opt_specificTest) != -1) {
      return [opt_specificTest];
    }
    return [];  // we didnt have this test, nothing
  }
  return result;
}

// Runs all the tests.
async function runTests(opt_specificTest, opt_retest) {
  // Find all the tests to run
  const mainTestNames = findTestNames_('test/src', opt_specificTest, opt_retest);
  const wasRetestMain = opt_retest && mainTestNames.length > 0;
  const webTestNames = findTestNames_('test/websrc', wasRetestMain ? undefined : opt_specificTest, opt_retest);

  const testConfig = parseJson(projectPath('test/testconfig.json'), false);

  let n = 0;
  for (const test of mainTestNames) {
    await runTest_(test, false, testConfig);
    n++;
  }

  for (const test of webTestNames) {
    await runTest_(test, true, testConfig);
    n++;
  }

  if (n == 0 && opt_specificTest) {
    console.log(`Error: Test not found: ${opt_specificTest}`);
    process.exit(1);
  } else if (n == 0) {
    console.log(`Error: No tests found`);
    process.exit(1);
  } else if (n >= 1) {
    console.log(`ALL TESTS PASSED (${n})`);
  }
  process.exit(0);
}

// Runs one test
async function runOneTest(specificTest) {
  await runTests(specificTest);
}

// Skips all tests before the given one
async function reTest(specificTest) {
  if (!specificTest) {
    throw new Error('Error: retest requires an argument');
  }
  await runTests(specificTest, true);
}

// Runs one test by writing out testrunnerinfo.json and launching.
async function runTest_(testName, isWeb, testConfig) {
  // Clear any prior result and prior data directory
  const resultPath = projectPath('out/build/testresult.json');
  fs.rmSync(resultPath, {force: true});
  fs.rmSync(projectPath('out/build/test/data'), {recursive: true, force: true});

  // Leave a note for the runner saying what test to run
  const info = {testName, isWeb};
  fs.writeFileSync(projectPath('out/build/testrunnerinfo.json'), JSON.stringify(info));

  const {testDataPairs, argv} = parseTestConfig_(testConfig, testName);
  for (const [fromPath, toPath] of testDataPairs) {
    fs.cpSync(projectPath(fromPath), projectPath(toPath), {recursive: true, force: true});
  }

  // Launch; if this doesn't exit with zero status then we'll fail it
  const p = projectPath('out/build');
  const electron = projectPath('out/build/node_modules/.bin/electron');
  await execScript(p, electron, '.', ...argv);

  // The runner should have left us a result file to confirm success
  const prefix = isWeb ? 'test/websrc/...' : 'test/src/...';
  const result = JSON.parse(fs.readFileSync(resultPath).toString());
  if (result && result.result === 'success') {
    if (result.testName != testName) {
      throw new Error(`Surprising mismatch between result file and intended test: ${result.testName} != ${testName}`);
    }
    console.log(`PASSED: ${prefix}/${testName}.ts`);
  } else {
    console.log(`FAILED: ${prefix}/${testName}.ts`);
    process.exit(1);
  }
}

// Returns {testDataPairs, argv} for the test with the given name
function parseTestConfig_(testConfig, testName) {
  let testDataPairs = undefined;
  let argv = [];
  const matchesRule = (rule) => {
    if (rule.test && rule.test === testName) {
      return true;
    }
    if (rule.tests && new RegExp(`^${rule.tests}$`).test(testName)) {
      return true;
    }
  };
  for (const rule of testConfig) {
    if (matchesRule(rule)) {
      if (rule.testdata !== undefined) {
        testDataPairs = [];
        if (!Array.isArray(rule.testdata)) {
          console.error(`Bad testdata parameter in testconfig.json, expected array of pairs but got: ${JSON.stringify(rule.testdata)}`);
          throw new Error('STOP_BUILD');
        }
        for (const pair of rule.testdata) {
          if (!Array.isArray(pair) || pair.length != 2) {
            console.error(`Bad testdata parameter in testconfig.json, expected pair item but got: ${JSON.stringify(pair)}`);
            throw new Error('STOP_BUILD');
          }
          testDataPairs.push(pair);
        }
      }
      if (rule.argv) {
        argv = rule.argv;
      }
      if (rule.argv && !Array.isArray(argv)) {
        console.error(`Bad argv parameter in testconfig.json: ${argv}`);
        throw new Error('STOP_BUILD');
      }
    }
  }
  return {testDataPairs, argv};
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
