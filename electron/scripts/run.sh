#!/bin/bash -l

set -e

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd ${SCRIPT_DIR}/..

./scripts/build.sh

cd out/build
./node_modules/.bin/electron .
cd -