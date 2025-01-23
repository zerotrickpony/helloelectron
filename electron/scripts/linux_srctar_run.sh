#/bin/bash

set -e

# TODO - you might edit this to set whatever trash you use on your Linux machine
export ELECTRON_TRASH=trash-cli

node ./scripts/builder.js run --no-sandbox
