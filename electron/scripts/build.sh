#!/bin/bash -l

set -e

# TODO - convert this to node

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd ${SCRIPT_DIR}/..

# Build the node.js process code and prepare dependencies
cd main
./node_modules/.bin/tsc --project main_tsconfig.json
cd ..

# Forward static dependencies and NPM dependencies for node.js
rm -f out/build/node_modules out/build/lib
ln -s $PWD/main/node_modules out/build/node_modules
ln -s $PWD/main/lib out/build/lib

# Package.json is read by electron to make build decisions. TODO - platform specific changes here
ln -sf $PWD/main/package.json out/build/package.json

# Build the products needed for the render process
./scripts/buildweb.sh
