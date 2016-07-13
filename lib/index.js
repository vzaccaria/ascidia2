#!/usr/bin/env node

const exp = require('./_index.js')

if (require.main === module) {
    exp.main();
} else {
    module.exports = exp
}
