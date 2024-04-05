#!/bin/bash -l

set -e

# TODO - convert this to node

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd ${SCRIPT_DIR}/..

# Build the web side; unlike node this goes all into one big JS file
mkdir -p out/build/web/lib
cd web
./node_modules/.bin/tsc --project webtsconfig.json
cd ..

# Compile with SASS and then merge into one file
main/node_modules/.bin/sass web/css:out/sass
echo "/* ALL COMPILED CSS */" > out/build/web/compiled.css
for cssfile in `find out/sass -name '*.css'`; do
  echo "/* $cssfile */" >> out/build/web/compiled.css
  cat $cssfile >> out/build/web/compiled.css
done

# Forward static resources and typescript source
mkdir -p out/build/web/web
rm -f out/build/web/lib/js out/build/web/lib/images out/build/web/web/src
ln -s $PWD/web/lib/js out/build/web/lib/js
ln -s $PWD/web/lib/images out/build/web/lib/images
ln -s $PWD/web/src out/build/web/web/src
cp web/lib/boot/require.js out/build/web/require.js
