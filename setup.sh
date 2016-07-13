#!/bin/sh
./node_modules/.bin/babel --presets es2015,stage-2 configure.js | node
