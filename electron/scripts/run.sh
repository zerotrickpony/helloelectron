#!/bin/bash

set -e

./scripts/build.sh

cd out/build
./node_modules/.bin/electron .
cd -
