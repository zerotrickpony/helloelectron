# Helloelectron: An Electron project template

# Overview

## Why this example Electron app

Electron, Typescript, NPM, Node.js, Electron-Forge, Squirrel, and other tools are very useful,
but are also full of rough edges and bad opinions. This project demonstrates a file structure
and build scripts that smoosh these tools together into a usable, capable project. In most
cases the many inter-operation problems are papered over using codegens and/or build scripts.
Although not ideal, this is often the only way to get these tools to work. The resulting
arrangemnt is fragile, but I hope it gives you a useful starting point.

## Should I use Electron?

> (If you're already sure you need Electron, skip down to "Getting Started").

Electron is a framework for making **native apps** on Windows, MacOS, and Linux. It's a good choice if:

- You know web programming and node.js programming, but not so much Windows or MacOS programming
- You need to deliver a native app on two or three OS platforms and want to reduce your development
  costs.
- You need to do something with the native OS that's not possible in a web browser.
- You don't need to deliver a mobile app.
- The UX you want to show could be expressed as HTML+CSS+JS (This is true for most apps, because
  web pages are ludicrously capable, including WebGL etc, which Electron can do.)
- You need to deliver a native app on just one platform, and you really don't want to learn native
  Windows / native Mac programming (and you do already know web development.)

Consider **not** using Electron if:

- You want to deliver only mobile apps. Consider Fluttr or Instant apps.
- You want to deliver game-like 3D graphics. Consider Godot or Unreal.
- You want a "write once" app that deploys to MacOS, iOS, Android, Windows, etc. Consider Godot,
  Fluttr, or just write multiple apps.
- You don't really need any native-only facilities, such as opening a server socket or accessing
  the user's local disk carte blanche. If you just need a GUI, consider delivering as a web page,
  it will be less work and your users will be able to access it more easily.
- You want to deliver a UX that's tightly integrated with a more exotic part of the native OS,
  such as a system tray icon, a dashboard widget, an accessibility plugin, or a control panel
  element. Electron doesn't abstract these things so well, so you may need to write native code.
- Your application requires a cloud service that you are going to maintain. Electron can still
  participate in that architecture as a native client, but if it's not going to help you avoid
  building out a cloud service, then you might consider whether you can serve a web GUI off your
  cloud service and avoid the native client.
- You want to deliver a very polished native experience on Windows or Mac. Consider building
  out two separate native apps.
- You don't know HTML/CSS nor node.js and don't want to learn
- You only need to deliver one native app on one platform. Consider simply developing the app
  natively, it will be easier than suffering the abstractions of Electron. Both Windows and MacOS
  native development are very thoroughly documented, better than Electron. (Exception: Unless you
  really know HTML/CSS/Node.js well and are very unwilling to learn the native APIs. See above.)

### Cross-platform Electron

In my opinion Electron shines brightest when your goal is to deliver one app on multiple native
OS's (e.g. Windows+Mac, or Mac+Linux, or all three.) Electron significantly reduces, thought it
does not eliminate, the costs of maintaining a native app on two or three OS platforms. If you
are targeting only one platform, Electron may not add much value to your project vs. just learning
the native OS toolkits. In order to offer cross-platform capabilities, Electron puts access to native
features like menu bars and system trays behind limited, clumsy abstractions. They work, but you
may find yourself lacking access to some elements of the native APIs that you could have used
if you were writing a native app.

Most of the non-GUI-related cross platform capabilities are provided by node.js, not really
Electron. So if you're working with the network, filesystem, or processes, expect not to find
anything different in Electron than what you'd have in node. This means that (for example) you'll
be subject to the usual leaky abstractions from node.js, such as file paths on Windows, etc.

On dependencies: Although you can enjoy the benefits of NPM packages in your app, beware that NPM
packages aren't always cross-platform. I have been burned multiple times by useful-looking NPM
packages that pull in native dependencies under the hood which refuse to compile on one of my target
platforms, or which choke on node.js leaky abstractions such as Windows path drive letters. My
advice is to limit the NPM packages you install, budget for cross-platform testing when you are
vetting a new dependency, and be prepared for several false starts (e.g. removing a dependency and
then trying an alternative) when you need a library. In several cases in my own projects I ended
up avoiding NPM entirely; it was easier to choose a native binary, manually build that binary on 3
platforms, store the binaries for each platform in git, and then spawning the binaries as separate
processes from my Electron app. Gross but reliable.

There are also a number of parts of Electron that do not abstract multiple OS's at all. You'll find
things like app updates, installers, and a few other things are just OS-specific implementations
that you have to manually call by writing `if (process.platform === 'win32') {` type statements
for. In this regard I feel that Electron is still helpful, but not really complete. Perhaps
these things will improve in the future.

Building and packaging in particular is one of those aspects; there's no single builder and there's
no crossbuild tools for Electron, you just have to debug each platform. I've done some of that
for you, see below.

# Get Started

### Set up this demo as-is:

- `nvm use v16`  (you don't have to use nvm if you have some other way of using node; any 16+ version should work)
- `git clone https://github.com/zerotrickpony/helloelectron.git`
- `cd helloelectron`
- `node electron/scripts/builder.js setup`

### Build and run the example in electron's development mode:

- `node electron/scripts/builder.js run`

### Package the hello app for your platform:

- `node electron/scripts/builder.js package`
- (on MacOS): `open ./electron/out/dist/helloelectron.app`

### Make your own app:

This is meant to be a template, not a tool, meaning that to use these patterns in your own
app, you will mostly clone this structure and modify the files. I didn't try to package this
example as a library, or make it easy to take new versions of this example in the future. So:

1. change electron/main/package.json:
  - Set "name" to the application name. This will become the DEB and installer name also;
    the Forge builder may choke on this if it's got capital letters, dashes, or whitespace.
    So for the sake of simplicity I kept it an all lower case single term.
  - Set "version" to an appropriate semver like 1.12.6.
  - Set "description" to a description of your app, I think this ends up in some metadata.
  - Set "author" to yourself
  - Set "license" to whatever is appropriate for your project.

2. add your own code and assets:
  - Place your Electron application code (main and render) in the file structure below.
  - There are places in the file structure for CSS, HTML templates, arbitrary libraries
    which can be included in your application bundle.
  - For UX you should be able to install a web framework of your choice. I like vanillaJS
    so I didn't include Svelt or React or Angular in this demo. You can have a look at the
    DomBox helper class I wrote, but it's not a strong dependency. I also included JQuery
    in the example project but you can erase it.

3. add IPC types and commands:
  - The main/render process split will make it unlikely that you'll get far before you need
    to use IPC. Note that synchronous IPC (e.g. call from the renderer down to node.js and
    then get a return value) is only available one way. You can send asynchronous IPC events
    from the main process back up to the renderer, but there's no facility for waiting for
    a response.
  - Some IPC commands are demonstrated in the demo, but you can add your own by modifying
    the code in `src/common/schema.ts`, see the `MainIpc` and `BrowserIpc` interfaces.
    Put the actual endpoint implementations into `mainipc.ts` and `browseripc.ts` respectively.
  - You'll also have to add a little bit of boilerplate in the sender `Client` classes in
    each file. You can search and replace the `getPlatformInfo` IPC for an example.


### Create your own tests

1. Create one or more files named "test_xxx.ts" in the test/src folder or test/websrc folder.
   (test/src files will execute in the main process, and test/websrc files will execute in
   the render process.)
2. Create a class in that file which extends BaseElectronTest
3. Add the line "new YourTest();" at the bottom of that file
4. (Optional) if your test needs a clean copy of test/data, or if it needs custom argv, you can
   configure that in `test/testconfig.json`.
4. Note that the tests run immediately, but you may want to wait for your app finish its own
   notion of startup / setup / readiness before your test runs. One way to do this is to start
   the test with a `"await waitFor(someGuiElementToAppear)"` type statement.
5. Run `./scripts/builder.js test`


### Package your app

> **Note:** You can only create a package for the platform currently running the tools. There is no
> cross-platform packaging for Electron, see "Known issues" below.

1. Run `./scripts/builder.js package`
2. Test the package locally / in-place. The in-place runnables are:
  - **On MacOS**: `open ./electron/out/dist/appname.app` (you can copy this to /Applications as-is)
  - **On Windows**: `./electron/out/dist/appname-0.0.1\ Setup.exe`

3. Distribute the app bundles created in `electron/out/dist`, which are like:
  - **On MacOS**: `electron/out/dist/appname-darwin-arm64-0.0.1.zip`
  - **On Linux**: `electron/out/dist/appname-linux-x64-0.0.1.deb`
  - **On Windows**: `electron/out/dist/appname-win32-x64-0.0.1-installer.zip`


### Remote updates for your app

If you want to use the remote update facility, then you can distribute updates to your app to your
existing users by placing a new bundle at a pre-determined URL that you control. To set up remote
updates:

1. Set the `electron/main/package.json` `"updatehost"` property to the URL where you will place
   self-updater descriptor files. The self updater will look at this URL for an appropriately
   named updateinfo.json file.
2. Set `"previousversion"` to whatever the prior semver was, if any. This is used to set the
   name of the updateinfo file, which is probed by apps of that version in the wild to discover
   updates. By default it checks once an hour.
3. Run `./scripts/builder.js package` as usual; this will generate an update info file and print out
   its exact name. For example `./electron/out/dist/helloelectron-darwin-arm64-updateinfo-0.0.3.json`.
   The update package will also be created.
4. Host the packaged distributable at the exact URL mentioned within the updateinfo file. The script
   will print out the URLs. For MacOS it's a `.zip` file, for Windows it's a `.nupkg` file. No
   self-update is available for Linux, see below.
5. Host the updateinfo file at the update URL that will be checked by prior versions of your app.
   For example, if your host base URL is "https://myapp.party/dist" then host the updateinfo file
   at `https://myapp.party/dist/helloelectron-darwin-arm64-updateinfo-0.0.3.json`. This will cause
   all apps in the wild at version 0.0.3 to read the contents of this file, and update themselves
   to 0.0.4. You can skip semvers by simply overwriting the older priorsemver json files with the
   latest one. For example, if the current version is 0.0.6, then you can place the current
   updateinfo file at `...updateinfo-0.0.3.json`,  `...updateinfo-0.0.4.json`, and
   `...updateinfo-0.0.5.json`. All versions in the wild will skip straight to 0.0.6.


## Security design advice

- TLDR, **Don't let Electron download code from the internet, because there is no safe way to do so.**
- Although Electron is built on Chromium as an implementation detail, don't design your
  Electron app to visit URLs of any sort. For example, if your app needs to display documentation,
  use app.open(url) to launch the user's web browser to visit the documentation URL. Do not use
  Electron's internal Chromium instance to visit the URL directly.
- Don't design your app to visit web pages or execute Javascript from the internet as part of how it
  functions. Yes Chromium can do this, but it's unsafe.
- Instead, use Chromium strictly as a UI engine, and only load code and HTML which was packaged
  into the application that sits within this git repo.
- If you want the app to update or change its behavior from the internet, use the self-updating
  capability included in this demo.
- See below for further design rationale.


## File structure

Here's some more detail on where to put which kinds of files so that they are built and packaged:

### Source code

- / : root of your project, put whatever you want in here, it will be ignored
- /electron : root of all code that will be part of electron
- /electron/scripts : the builder.js script which does everything
- /electron/main : root of code and configuration for the node.js process
- /electron/main/src : Typescript code for the node.js process
- /electron/main/src/common : Magic directory for typescript code that will also be compiled into the web side
- /electron/web : root of code and configuration for the renderer process
- /electron/web/src : Typescript code to be compiled for the renderer process

### Dependencies

- /electron/main/lib : any files which are to be forwarded as-is into the electron bundle
- /electron/main/lib/win : files that should only go into the Windows electron bundle
- /electron/main/lib/darwin : files that should only go into the MacOS electron bundle
- /electron/main/lib/linux : files that should only go into the Linux electron bundle
- /electron/main/node_modules : Electron itself, and any NPM libraries, will be packaged from here
- /electron/web/lib : Resources like images and CSS which will be served into the renderer
- /electron/web/lib/js : If there are any non-TS files to be served directly, they go here
- /electron/web/node_modules : TODO - check if web modules work

### Assets

- /electron/web/css : SASS source files which to be compiled into CSS for the renderer process
- /electron/web/lib/images : Image source files available to the renderer
- /electron/web/lib/data : If present, any other kind of includable resource for the web side
- /electron/art/appicon.png : The icon graphic which will be used as the live app icon on Windows and Linux
- /electron/art/macos-icon.png : A separate graphic for the Apple style guide which will show in the MacOS dock
- /electron/main/lib/win/installation.gif : The Winstaller installation animated GIF

### Test code

- /electron/test : place for tests to be authored.
- /electron/test/src : Typescript test source code which runs in the main process.
- /electron/test/websrc : Typescript test source code which runs in the render process.
- /electron/test/lib : Resources which will be added to the Electron bundle in test/lib.
- /electron/test/data : Data that's made available to each test and reset, see testconfig.json:testdata
- /electron/test/testconfig.json : Defines per-test setup behavior like custom argvs

### Generated outputs

When you run `electron/scripts/builder.js` it generally puts things under "out". In detail:

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
- /electron/out/sass : temporary SASS compiler output, this isn't used at runtime
- /electron/out/testtsc : temporary staging area for test tsc output; this isn't used at runtime
- /electron/out/package : staging area for Electron-Forge packager; anything important is moved to "dist" later.
- /electron/out/dist : The packaged Electron app and associated updater files will land here
- /electron/out/testdata : a copy of /test/data which is copied between each test run, accessed during tests


# Design Rationale

## Objectives

After struggling with Electron for a couple years, I wanted to start over with a cleaner
and more capable project structure. Here were my goals:

P0:
- Typescript throughout
- HTML+CSS brought into the renderer
- Custom image resources available in the renderer
- Common typescript code that can be used in both the renderer and the node process
- NPM packages available in the node.js process
- A test scaffold that can launch the full application and then run tests within the renderer
- Development mode electron launcher
- Debuggable typescript with correct source map within the renderer's dev console
- VSCode understands the types and can typecheck all flavors of typescript in the project

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

## Challenges

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

## Dependencies

- **node.js** - to run build script
- **electron** - to build the app
- **npm** - to bring in typescript and other tools
- **typescript** - if you want to compile typescript into javascript
- **electron-forge** - for packaging
- **requirejs** - for bootstrapping JS modules into the render process
- **squirrel** - for the windows installer, and the OTA updater
- **VSCode** - not a build dependency but implicit in the environment
- **Sass** - if you want compiled SCSS
- **source-map-support** - a workaround for typescript sources in stack traces
- **VSCode emeraldwalk.runonsave extension** - for running build scripts on file save
- **better-sqlite3** - if you want to use a SQLite database with your app


## Appeasing Typescript

One significant challenge is finding a directory structure and tsconfig which simultaneously
appease several different conflicting audiences for the Typescript and its compiled output:

- VSCode helps itself to anything called "tsconfig.json", and whatever it finds must allow it
  to resolve all types and relative include paths in all parts of the codebase
  (main, web, test, etc). If not, then you get red squiggles and the interactive type checking
  ("intellisense" ugh) doesn't work. VSCode doesn't support multiple tsconfigs, doesn't
  understand the idea of separated main and render processes, and doesn't understand
  non-standard build steps like template generated code.

- For the actual build, Electron's main process should not attempt to compile or typecheck
  code intended for the Chromium renderer. Fortunately, Electron doesn't care about the
  Typescript after it's built, but it does need to have source mapping be correct for
  stack traces. (And attaching a remote debugger, though I haven't tested that yet.)

- Module resolution in the main process must be compatible with node.js, which doesn't support
  monolith files or commonJS in Typescript. Chromium doesn't directly support module resolution
  AT ALL, so module loading must be mitigated via a third party package like requireJs.

- Electron's render process, which is Chromium, supports a single file monolith for compiled
  JS output, and that simplifies things. Like the above, the compiled result must not attempt
  to reference node.js APIs because those don't work within the renderer. In the compiled
  monolith there's no need for any relative paths to resolve, except that when debugging the
  app Chromium will attempt to load all the .ts files from the referenced source map. To make
  this work, the .ts files must be massaged into place, or the source map must be corrected.

- All three of the above conflicting audiences also pertain to test code. Testing code should
  not be compiled into the final package, but needs to be able to reference code present in
  the application.

- Test code is needed in both the main and render processes, and realistically it should be
  possible to write tests driven primarily from either the main or render process.

I've decided to solve the above seemingly conflicting needs with multiple tsconfigs, managed
by the wrapper script in "./scripts/builder.js". The "tsconfig.json" file at the top of the
project is solely to appease VSCode, because VSCode is the least flexible of the audiences.
This file is never used to build runnable code. The actual runnable configurations can be
found in the "blah_testconfig.json" files located with their sub-directories. A few points:

- node.js requires node16 module resolution. No other resolutions are valid with Typescript
  and node as of this writing. They will seem to work but they are subtlely broken. As of this
  writing, the maintainers of Node and Typescript seem to be having some kind of petty feud,
  see here for the sordid details:
  - https://github.com/microsoft/TypeScript/issues/42151
  - https://github.com/nodejs/node/issues/46006

- We choose single-file output for all renderer code because it avoids the need for complex
  directory layout. It does NOT do anything particularly for performance because unlike the
  JS in a web page, all code for Electron is local.

- We nested the common/ code within the main process src to make import paths work in node.
  I tried other arrangements but found it impossible to appease VSCode without something like
  symlinks.


# Known issues and Future Work

## Packaging

- No self-update facility is offered for Linux. It's expected that users will use their
  platform's .deb-based package manager instead.
- **no crossbuild**: Nothing in the Electron ecosystem that I have seen supports anything like
  cross-platform packaging tools. The only way to build the MacOS package is to run the packager
  on Apple hardware. The only way to build the Linux DEB is to run the packager on Linux. Etc.
  The closest thing to cross-build is to use a third party CI service like Travis to remotely
  run the packager on a cluster of build machines which have the needed OS on them. For myself
  I just have a little stack of spare laptops (Linux, MacOS Intel, MacOS M1, Windows 10) which
  I use to package each version of my app. This will likely never be fixed because the proprietary
  OSes (MacOS and Windows) are actively hostile to receiving packages not created using their
  proprietary signing tools, which are only available on their hardware.

## Security considerations

- The electron version is pinned at 20.3.5, and node 16. There are definitely later versions, and
  you could try to update them for features or security. Unfortunately the later versions of Electron
  significantly limited the IPC and source loading facilities, to treat web source as more untrusted
  I guess. This was done because Electron acknowledges the reality that many applications do not heed
  the above advice, and work by allowing Chromium to visit arbitrary URLs. Unfortunately, the measures
  added by Electron 21+ significantly hobble the usefulness of Electron's renderer, while still not
  fully securing the environment against untrusted code. The only actually secure way to use
  Electron is to not visit internet URLs or download internet resources **at all**.
  Executing ANY code from the internet is going to carry risk, and it's easier (and makes more sense)
  to simply run only bundled code. See above.
- "Electron Security Warning" shows up in the dev console for unpackaged apps. I think if you want
  to use things like jquery within your render process, this is unavoidable?

## Debugging

- node.js should have source maps but can't be turned on by electron, so i am using the
  "source-map-support" which demands a manual line added to every js file.
- The ts source for dev console source mapping is forwarded to a kooky place (web/web)
- The electronpreload.js cannot have a source map, because that file is loaded in a special way
  that doesn't permit its corresponding source map file to ever be accessible.
- I haven't tried attaching a remote debugger to the node.js process, not sure if that works.

## Directory structure and extraneous files

- Forge manipulates NPM during its build process, so an npm install is necessary to
  recover from the packager's behavior. This means we depend on NPM's servers for packaging.
- The scripts directory has to have a package.json file to appease node.js for modules.


## TODOs

- ✅ get ts working in main process in a basic way
- ✅ try compiled.js and see if source map works in renderer
- ✅ make a "just the web" compilation script
- ✅ try using "sass" for CSS compilation: https://sass-lang.com/guide/#example-variables-scss
- ✅ ErrorReport class
- ✅ Type safe command dispatch using some sort of IDL or common interface
- ✅ try packaging
- ✅ port the scripts to node.js
- ✅ strip out the source map from electronpreload.js to get rid of the error message
- ✅ write out updateinfo.json as part of packaging
- ✅ Logger facility
- ✅ rename HtmlBuilder to something more pithy like DBox or DomBox or DivBox or NodeBox.
- ✅ try using a native dependency like better-sqlite3, and add the electron rebuild statement to the script
- ✅ get tests working
  - ✅ compile a version of the app with the test code in it
  - ✅ make sure that code in test can refer to prod code
  - ✅ rewrite require statements and reparent the test code
  - ✅ fix up paths in the source map files for the test code
  - ✅ generate hooks that register all the tests (does module code run? maybe i could generate includes)
  - ✅ launch and make sure it sort of works
  - ✅ testing harness that sets up the code each time
  - ✅ bring in test/websrc source for debugger
  - ✅ run just one test, pick from the command line
  - ✅ open dev console on test failure
  - ✅ test/data redeployments
  - ✅ just pass actual argv to the process during the test, dont use fakeArgv? testsetup.json
  - ✅ consider any crash anywhere in the app to also be a test failure.
  - need to put a test/node_modules and a test/package.json in there
- updater scheme / OTA update support
- bug: restart app button in crash reporter doesnt work
- try npm install non-dev web dependencies, what happens to them?
- add toasts to the GUI, and toast on update
- add wrapper scripts for "npm install --save"
- test updater on mac
- test packaging: Linux
  - linux packager has wrong path, it should refer to the .deb not the zip
- test packaging: Win
  - add Windows signing instructions and setup
  - test updater
- test packaging: Mac x64
- notarization for macos
- the default behavior of the app shows an ugly printout, this is not a good demo.
- demonstrate mixing in raw JS?
- backport all my web test matchers into this example
