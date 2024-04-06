#!/bin/bash -l

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd ${SCRIPT_DIR}/..

rm -rf main/node_modules web/node_modules out

# Do NPM install
cd main
npm install
cd ..
cd web
npm install
cd ..

# Then build
./scripts/build.sh
