# Electron project template

## Overview

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
- The Squirrel windows installer is of the rather wild opinion that it should have no options or confirmations.
- The "iconz" tool that I found for generating MacOS ICNS files only actually runs correctly on MacOS hosts
- The self-updating systems available for Electron are VERY over-complicated. Some of them demand needless
  client-side complexity, and some of them refuse to work without running a live server with a Reddis cluster
  (lol) and other Things That Are Not Simply A Static File. For this demo I have trimmed down what's needed.

### Dependencies

- node.js
- electron
- npm
- typescript
- electron-forge
- requirejs (for bootstrapping JS modules into the render process)
- squirrel (for the windows installer, and the OTA updater)
- better-sqlite3 (not necessary but proves that NPM works)
- VSCode (not a build dependency but implicit in the environment)
- Bash (there are a few short bash scripts on non-Windows)
- BAT files (Windows only, mostly they just run node.js)
- Sass (for CSS)
- source-map-support (a workaround for typescript sources in stack traces)
- VSCode emeraldwalk.runonsave extension (for running build scripts on file save)


### File structure

#### Source code and dependencies

- / : root of your project, put whatever you want in here
- /electron : root of all code that will be part of electron
- /electron/scripts : the builder.js script which does everything
- /electron/main : root of code and configuration for the node.js process
- /electron/main/src : Typescript code for the node.js process
- /electron/main/src/common : Magic directory for typescript code that will also be compiled into the web side
- /electron/main/lib : any files which are to be forwarded as-is into the electron bundle
- /electron/main/lib/win : files that should only go into the Windows electron bundle
- /electron/main/lib/darwin : files that should only go into the MacOS electron bundle
- /electron/main/lib/linux : files that should only go into the Linux electron bundle
- /electron/web : root of code and configuration for the renderer process
- /electron/web/src : Typescript code to be compiled for the renderer process
- /electron/web/css : CSS source files which to be compiled for the renderer process
- /electron/web/lib : Resources like images and CSS which will be served into the renderer
- /electron/web/lib/js : If there are any non-TS files to be served directly, they go here

#### Assets

- /electron/art/appicon.png : The icon graphic which will be used as the live app icon on Windows and Linux
- /electron/art/macos-icon.png : A separate graphic for the Apple style guide which will show in the MacOS dock
- /electron/main/lib/win/installation.gif : The Winstaller installation animated GIF
- /electron/web/lib/images : Image source files available to the renderer
- /electron/web/lib/data : If present, any other kind of includable resource for the web side

#### Test code

- /electron/test : place for tests to be authored.
- /electron/test/src : Typescript test source code. Must instantiate objects that extend ElectronTest
- /electron/test/data : Data that's available to each test. This is cloned on each test run

#### Generated outputs

- /electron/out : all temporary build products go here
- /electron/out/build : runnable files for electron to run in place during development and test
- /electron/out/build/web : files that will be served into the renderer
- /electron/out/build/web/appicon.png : Windows and Linux app window icon
- /electron/out/build/web/appicon.icns : Generated MacOS dock icon (darwin only)
- /electron/out/build/web/appicon.ico : Windows package icon
- /electron/out/build/web/compiled.js : all TS source for the renderer in one monolith
- /electron/out/build/web/compiled.css : all CSS for the renderer in one monolith
- /electron/out/build/web/web/src : the original typescript files, only here for debugging (remove to obfuscate)
- /electron/out/build/web/lib : original images, raw js, and data, forwarded as-is into the build package
- /electron/out/sass : temporary SASS compiler output
- /electron/out/package : staging area for Electron-Forge packager
- /electron/out/dist : The packaged Electron app and associated updater files will land here
- /electron/out/testdata : a copy of /test/data which is copied between each test run, accessed during tests

### TODO

- ✅ get ts working in main process in a basic way
- ✅ try compiled.js and see if source map works in renderer
- ✅ make a "just the web" compilation script
- ✅ try using "sass" for CSS compilation: https://sass-lang.com/guide/#example-variables-scss
- ✅ ErrorReport class
- ✅ Type safe command dispatch using some sort of IDL or common interface
- ✅ try packaging
- ✅ port the scripts to node.js
- ✅ strip out the source map from electronpreload.js to get rid of the error message
- write out updateinfo.json as part of packaging
- Logger facility
- get tests working
- bumpversion utility
- updater scheme / OTA update support
- test packaging: Linux
- test packaging: Win
- test packaging: Mac x64
- pref support?
- demonstrate mixing in raw JS?


## Getting Started

#### First time:

- git clone where/did/you/find/this/repo/helloelectron
- cd helloelectron
- node electron/scripts/builder.js setup

#### Run the example in electron's development mode:

- node electron/scripts/builder.js run

#### Package the hello app for MacOS:

- node electron/scripts/builder.js package
- open ./electron/out/dist/helloelectron.app

#### Make your own app:

This is meant to be a template, not a tool, meaning that to use these patterns in your own
app, you will mostly clone this structure and modify the files. I didn't try to package this
example as a library, or make it easy to take new versions of this example in the future. So:

1. change electron/main/package.json:
  - Set "name" to the application name. This will become the DEB and installer name also;
    the Forge builder may choke on this if it's got capital letters, dashes, or whitespace.
    So for the sake of simplicity I kept it an all lower case single term.
  - Set "version" to an appropriate semver like 1.12.6.The builder.js "bumpversion" command
    will increment this and leave behind the prior version in "previousversion", see below.
  - Set "description" to a description of your app, I think this ends up in some metadata.
  - Set "author" to yourself
  - Set "license" to whatever is appropriate for your project.
  - Set "updatehost" to the URL where you will place self-updater descriptor files. The self
    updater will look at this directory for an appropriately named updateinfo.json file.
    builder.js "package" will generate this file and print out instructions for placing it.
  - Set "previousversion" to whatever the prior semver was, if any. The builder.js "bumpversion"
    command will update this field.


## Known issues

#### Security considerations

- The electron version is pinned at 20.3.5. Versions after this significantly overhauled the
  IPC and source loading facilities, to treat web source as more untrusted in some way. I think
  this is reasonable for people who are using Electron to download and execute code from the
  internet... but IMO a better approach is not to architect your Electron app that way. Executing
  ANY code from the internet is going to carry risk, and it's easier (and makes more sense) to
  simply run only bundled code.
- "Electron Security Warning" shows up in the dev console for unpackaged apps. I think if you want
  to use things like jquery within your render process, this is unavoidable?

#### Debugging

- node.js should have source maps but can't be turned on by electron, so i am using the "source-map-support"
  which demands a manual line added to every js file.
- The ts source for dev console source mapping is forwarded to a kooky place (web/web)
- The electronpreload.js cannot have a source map, because that file is loaded in a special way
  that doesn't permit its corresponding source map file to ever be accessible.

#### Directory structure and extraneous files

- Forge manipulates NPM during its build process, so an npm install is necessary to
  recover from the packager's behavior. This means we depend on NPM's servers for packaging.
- The scripts directory has to have a package.json file to appease node.js for modules
