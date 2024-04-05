#!/bin/bash -l

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd ${SCRIPT_DIR}/..

# Do NPM install
cd main
npm install
cd ..
cd web
npm install
cd ..

# Then build
./scripts/build.sh
