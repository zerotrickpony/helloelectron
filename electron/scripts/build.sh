#!/bin/bash

set -e

# TODO - convert this to node

# Build the node.js process code and prepare dependencies
cd main
npm run build
cd ..

# Forward static dependencies and NPM dependencies for node.js
rm -f out/build/node_modules out/build/lib
ln -s $PWD/main/node_modules out/build/node_modules
ln -s $PWD/main/lib out/build/lib

# Package.json is read by electron to make build decisions. TODO - platform specific changes here
ln -sf $PWD/main/package.json out/build/package.json

# Build the web side; unlike node this goes all into one big JS file
./scripts/buildweb.sh

# Forward static resources
cp web/lib/boot/require.js out/build/web/require.js
rm -f out/build/web/lib/js out/build/web/lib/images out/build/web/web/src
ln -s $PWD/web/lib/js out/build/web/lib/js
ln -s $PWD/web/lib/images out/build/web/lib/images

# Forward typescript source so that the source maps work in the renderer
mkdir -p out/build/web/web
ln -s $PWD/web/src out/build/web/web/src
