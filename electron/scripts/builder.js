#!/bin/node

// This script builds the project to a locally runnable state. Typescript errors are
// emitted, and it sets up symlinks for in-place local running. To package the app
// for distribution, look at ./scripts/package.js instead.

import fs from 'fs';
import {execScript, execNpm, projectPath, runSteps, symlinkSync, listDirR, readFileLines} from './_base.js';

const COMMANDS = new Map([
  ['setup', ['First time installation and build',
      cleanOut, cleanNpm, install, buildMain, buildWeb, buildCss]],
  ['clean', ['Erases all build output',
      cleanOut, buildMain, buildWeb, buildCss]],
  ['build', ['Builds the electron project for development mode',
      buildMain, buildWeb, buildCss]],
  ['web', ['Builds just the render process Typescript and CSS',
      buildWeb, buildCss]],
  ['css', ['Builds just the CSS',
      buildCss]],
  ['run', ['Builds and runs the Electron app in development mode',
      buildMain, buildWeb, buildCss, runDev]],
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
}

// Builds the main process code
async function buildMain() {
  // Build the main process Typescript
  const main = projectPath('main');
  const tsc = projectPath('main/node_modules/.bin/tsc');
  await execScript(main, tsc, '--project', 'main_tsconfig.json');

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
      const suffix = cssPath.substring(projectPath('out/sass').length);
      lines.push(`/* ${suffix} */`);
      for (const line of await readFileLines(cssPath)) {
        if (line.indexOf('# sourceMappingURL') == -1) {  // strip out source maps
          lines.push(line);
        }
      }
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

function printHelp() {
  console.log(`
Syntax: node ./scripts/builder.js <command>

Where the command is one of:`);
  for (const [command, helpAndSteps] of COMMANDS) {
    console.log(`"${command}": ${helpAndSteps[0]}`);
  }
}
