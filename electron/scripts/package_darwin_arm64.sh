#!/bin/bash -l

set -e

# TODO - generate package.json with these variables so they dont have to be manually inserted
APPVERSION=0.0.1
RELKEY=etghrweghwjhkegrtwehjrk  # TODO - generate app keys in node
UPDATEURL=https://photoferret.tech/dist
APPNAME=helloelectron

# TODO - move this to node, and maybe consolidate the build scripts into one?

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd ${SCRIPT_DIR}/..

# First, build the dev version clean
rm -rf out
./scripts/build.sh

# Stage the real package in a new directory.
cd ${SCRIPT_DIR}/..
cp -r -P out/build out/package

# Replace the lib symlinks with real copies so we can manipulate them
rm out/package/lib out/package/package.json out/package/web/lib/js out/package/web/lib/images
cp $PWD/main/package.json out/package/package.json  # TODO - manipulate the version number in here
cp -r $PWD/main/lib out/package/lib
cp -r $PWD/web/lib/js out/package/web/lib/js
cp -r $PWD/web/lib/images out/package/web/lib/images
rm -rf out/package/lib/win
rm -rf out/package/lib/linux
rm -rf out/package/web/lib/win
rm -rf out/package/web/lib/linux
rm -rf out/package/web/lib/js/win
rm -rf out/package/web/lib/js/linux
rm -rf out/package/web/lib/images/win
rm -rf out/package/web/lib/images/linux

# Place the MacOS icon, it has to have the same path as appicon.ico for Forge
cp art/appicon.icns out/package/web/lib/images/appicon.icns

# Place the version reflection stuff
echo "$RELKEY" > out/package/lib/relkey.txt
echo "$APPVERSION" > out/package/lib/appversion.txt
echo "${UPDATEURL}/$RELKEY/${APPNAME}-darwin-arm64-updateinfo-$APPVERSION.json" > out/package/lib/updateinfo.txt

# Run forge
cp main/darwin_forge.config.js out/package/forge.config.js
cd out/package
node_modules/.bin/electron-forge make
cd -

# Forge helps itself to an NPM prune!!! Gotta put back my dev dependencies
echo "Restoring dev dependencies which forge erases?!?"
cd main
npm install
cd -

# Stage the zip and app
mkdir -p out/dist
cp out/package/out/make/zip/darwin/arm64/${APPNAME}-darwin-arm64-$APPVERSION.zip out/dist
unzip out/dist/${APPNAME}-darwin-arm64-$APPVERSION.zip -d ./out/dist

echo "Downloadable MacOS zip at out/dist/${APPNAME}-darwin-arm64-$APPVERSION.zip"
echo "Executable MacOS Application bundle at out/dist/${APPNAME}"
