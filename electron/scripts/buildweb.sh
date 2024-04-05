#!/bin/bash

set -e

# TODO - convert this to node

# Build the web side; unlike node this goes all into one big JS file
mkdir -p out/build/web/lib
cd web
npm run build
cd ..

# Compile with SASS and then merge into one file
main/node_modules/.bin/sass web/lib/css:out/build/sass
echo "/* ALL COMPILED CSS */" > out/build/web/compiled.css
for cssfile in `find out/build/sass -name '*.css'`; do
  echo "/* $cssfile */" >> out/build/web/compiled.css
  cat $cssfile >> out/build/web/compiled.css
done
