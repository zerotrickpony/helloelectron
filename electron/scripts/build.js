#!/bin/node

// This script builds the project to a locally runnable state. Typescript errors are
// emitted, and it sets up symlinks for in-place local running. To package the app
// for distribution, look at ./scripts/package.js instead.

import fs from 'fs';
import {execScript, projectPath, runSteps, symlinkSync, listDirR, readFileLines} from './_base.js';

function parseMode() {
  const text = process.argv[process.argv.length - 1];
  if (text.toLowerCase() == 'web') {
    return {buildMain: false, buildWeb: true, buildCss: true};
  } else if (text.toLowerCase() === 'css') {
    return {buildMain: false, buildWeb: false, buildCss: true};
  } else if (text.toLowerCase() === 'run') {
    return {buildMain: true, buildWeb: true, buildCss: true, runDev: true};
  } else {
    return {buildMain: true, buildWeb: true, buildCss: true};
  }
}

await runSteps(async x => {
  const {buildMain, buildWeb, buildCss, runDev} = parseMode();

  if (buildMain) {
    // Build the main process Typescript
    const main = projectPath('main');
    const tsc = projectPath('main/node_modules/.bin/tsc');
    await execScript(main, tsc, '--project', 'main_tsconfig.json');

    // Forward node_modules into the build directory using symlinks
    symlinkSync(projectPath('main/node_modules'), projectPath('out/build/node_modules'));
    symlinkSync(projectPath('main/lib'), projectPath('out/build/lib'));
    symlinkSync(projectPath('main/package.json'), projectPath('out/build/package.json'));
  }

  if (buildWeb) {
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

  if (buildCss) {
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

  if (runDev) {
    // Launch the development mode tool
    const p = projectPath('out/build');
    const electron = projectPath('out/build/node_modules/.bin/electron');
    await execScript(p, electron, '.');
  }
});
