'use strict';

/* eslint quotes: [0], strict: [0] */

var _require = require('zaccaria-cli');

var _ = _require._;
var $d = _require.$d;
var $o = _require.$o;
var $fs = _require.$fs;
var $b = _require.$b;
var $s = _require.$s;


var path = require('path');

var debug = require('debug');
var shelljs = $s;
var bluebird = $b;

var readLocal = function readLocal(f) {
    var curdir = path.dirname($fs.realpathSync(__filename));
    var filepath = path.join(curdir, '../' + f);
    return $fs.readFileAsync(filepath, 'utf8');
};

var getOptions = function getOptions(doc) {
    "use strict";

    var o = $d(doc);
    var help = $o('-h', '--help', false, o);
    return {
        help: help
    };
};

var main = function main() {
    readLocal('docs/usage.md').then(function (it) {
        var _getOptions = getOptions(it);

        var help = _getOptions.help;

        if (help) {
            console.log(it);
        }
    });
};

var _module = require('./module');
_module = _module({
    debug: debug, _: _, shelljs: shelljs, bluebird: bluebird
});

module.exports = _.assign({
    main: main
}, _module);