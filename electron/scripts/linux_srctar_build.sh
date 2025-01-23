#/bin/bash

set -e

if [ x`which node` = 'x' ]; then
  echo 'Make sure nvm and pyenv are installed and set, see README'
  exit
fi

node ./scripts/builder.js setup
node ./scripts/builder.js build
