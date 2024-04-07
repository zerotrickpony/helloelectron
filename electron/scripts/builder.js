#!/bin/node

// This script builds the project to a locally runnable state. Typescript errors are
// emitted, and it sets up symlinks for in-place local running. To package the app
// for distribution, look at ./scripts/package.js instead.

import fs from 'fs';
import {execScript, execNpm, projectPath, runSteps, symlinkSync, listDirR, readFileLines} from './_base.js';

function parseSteps() {
  const text = process.argv[process.argv.length - 1];
  if (text.toLowerCase() == 'setup') {
    return [cleanOut, cleanNpm, install, buildMain, buildWeb, buildCss];
  } else if (text.toLowerCase() == 'web') {
    return [buildWeb, buildCss];
  } else if (text.toLowerCase() === 'css') {
    return [buildCss];
  } else if (text.toLowerCase() === 'run') {
    return [buildMain, buildWeb, buildCss, runDev];
  } else if (text.toLowerCase() === 'clean') {
    return [cleanOut, buildMain, buildWeb, buildCss];
  } else {  // normal full build
    return [buildMain, buildWeb, buildCss];
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
