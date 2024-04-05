# Electron project template

### Motivation

Electron, Typescript, NPM, Node.js, Electron-Forge, Squirrel, and other tools are very useful,
but are also full of rough edges and bad opinions. This project demonstrates a file structure
and build scripts that smoosh these tools together into a usable, capable project. In most
cases the many inter-operation problems are papered over using codegens and/or build scripts.
Although not ideal, this is often the only way to get these tools to work. The resulting
arrangemnt is fragile, so tinker with caution.

### Objective

This structure demonstrates a starting point for an Electron app with the
following capabilities:

P0:
- Typescript throughout
- HTML+CSS brought into the renderer
- Custom image resources available in the renderer
- Common typescript code that can be used in both the renderer and the node process
- NPM packages available in the node.js process
- A test scaffold that can launch the full application and then run tests within the renderer
- Development mode electron launcher
- Debuggable typescript with correct source map within the renderer's dev console
- VSCode understands the types and can typecheck all 3 flavors of typescript in the project

P1:
- App packagers for Linux, MacOS, MacOS intel, and Windows
- Windows installer
- Documentation generator that uses zola
- Correct source maps in node.js stack traces
- Crash handling
- Tests can be written in typescript

P2:
- NPM packages available in the renderer (TODO)
- Tests that can run in node
- A GUI framework that avoids jquery
- Compiled CSS in TBD CSS abstraction language (SASS?)
- Scaffolding that I find useful to have in graphical Electron apps

### Challenges

A partial list of problems that this project works around, mostly through wrapper scripts, copying, and symlinking:

- Electron has two different code environments (main and renderer) which don't work together, by design
- Electron's packagers are half broken on different platforms
- NPM isn't aware of the web/main split in Electron
- Later versions of electron stymie renderer code loading in a misguided attempt to improve security
- Off the shelf testing frameworks are not aware of electron's special way of launching
- CommonJS modules have a kooky import syntax that's incompatible with ESM modules
- Typescript's support for ESM modules is deliberately broken for node.js
- Node.js's support for ESM modules deliberately refuses to work with Typescript
- Chrome has no module loading support at all
- Typescript won't generate code that inter-operates with in-place source, so all resources must be copied
- VSCode tries to parse the tsconfig itself, and won't understand nuance from multi-armed build systems or codegens
- NPM defaults to auto-updating packages which often breaks them

### Dependencies

- node.js
- electron
- npm
- typescript
- electron-forge
- requirejs (for bootstrapping JS modules into the render process)
- squirrel (for the windows installer)
- better-sqlite3 (not necessary but proves that NPM works)
- VSCode (not a build dependency but implicit in the environment)
- Bash (there are a few short bash scripts on non-Windows)
- BAT files (Windows only, mostly they just run node.js)
- Sass (for CSS)
- source-map-support (a workaround for typescript sources in stack traces)
- VSCode emeraldwalk.runonsave extension (for running build scripts on file save)


### File structure

- / : root of your project, put whatever you want in here
- /electron : root of all code that will be part of electron
- /electron/scripts : scripts which do builds, run tests, and release packaging
- /electron/main : root of code and configuration for the node.js process
- /electron/main/src : Typescript code for the node.js process
- /electron/main/src/common : Magic directory for typescript code that will also be compiled into the web side
- /electron/main/lib : any files which are to be forwarded as-is into the electron bundle
- /electron/web : root of code and configuration for the renderer process
- /electron/web/src : Typescript code to be compiled for the renderer process
- /electron/web/css : CSS source files which to be compiled for the renderer process
- /electron/web/lib : Resources like images and CSS which will be served into the renderer
- /electron/web/lib/js : If there are any non-TS files to be served directly, they go here
- /electron/web/lib/images : Image source files available to the renderer
- /electron/web/lib/data : If present, any other kind of includable resource for the web side
- /electron/test : place for tests to be authored.
- /electron/test/src : Typescript test source code. Must instantiate objects that extend ElectronTest
- /electron/test/data : Data that's available to each test. This is cloned on each test run
- /electron/out : all temporary build products go here
- /electron/out/build : runnable files for electron to run in place during development and test
- /electron/out/build/web : files that will be served into the renderer
- /electron/out/build/web/compiled.js : all TS source for the renderer in one monolith
- /electron/out/build/web/compiled.css : all CSS for the renderer in one monolith
- /electron/out/build/web/web/src : the original typescript files, only here for debugging (remove to obfuscate)
- /electron/out/build/web/lib : original images, raw js, and data, forwarded as-is into the build package
- /electron/out/dist : the build area for the current platform's packager
- /electron/out/testdata : a copy of /test/data which is copied between each test run, accessed during tests

### TODO

- ✅ get ts working in main process in a basic way
- ✅ try compiled.js and see if source map works in renderer
- ✅ make a "just the web" compilation script
- ✅ try using "sass" for CSS compilation: https://sass-lang.com/guide/#example-variables-scss
- ✅ ErrorReport class
- ✅ Type safe command dispatch using some sort of IDL or common interface
- try packaging
- make a script that works on Windows; port it all to node.js?
- centrally manage version numbers and stuff, using idk genfiles? or read package.json?
- get tests working
- pref support?
- Filer?
- mix in raw JS?


### Known issues

- ts source is forwarded to a kooky place (web/web)
- error message for electronpreload.js.map source map. Could move it to JS? Could get it working?
- node.js should have source maps but can't be turned on by electron, so i am trying out the "source-map-support"
  which demands a manual line added to every js file.

### Installation

#### First time:

- git clone where/did/you/find/this/repo/helloelectron
- cd helloelectron
- electron/scripts/setup.sh

#### Run the example in electron's development mode:


