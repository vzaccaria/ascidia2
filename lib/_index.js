'use strict';

/* eslint quotes: [0], strict: [0] */

var _require = require('zaccaria-cli');

var _ = _require._;
var $d = _require.$d;
var $o = _require.$o;
var $fs = _require.$fs;
var $b = _require.$b;
var $s = _require.$s;


function exec(cmd) {
    "use strict";

    console.log(cmd);
    return new $b(function (resolve, reject) {
        require('shelljs').exec(cmd, {
            async: true,
            silent: true
        }, function (code, output) {
            if (code !== 0) {
                reject(output);
            } else {
                resolve(output);
            }
        });
    });
}

var path = require('path');

var debug = require('debug');
var shelljs = $s;
var bluebird = $b;

var readLocal = function readLocal(f) {
    var curdir = path.dirname($fs.realpathSync(__filename));
    var filepath = path.join(curdir, '../' + f);
    return $fs.readFileAsync(filepath, 'utf8');
};

var _module = require('./module');

_module = _module({
    debug: debug,
    _: _,
    shelljs: shelljs,
    bluebird: bluebird
});

var getOptions = function getOptions(doc) {
    "use strict";

    var o = $d(doc);
    var help = $o('-h', '--help', false, o);
    var png = $o('-p', '--png', false, o);
    var html = $o('-t', '--html', false, o);
    var filename = o['INPUT'];
    var output = $o('-o', '--output', undefined, o);
    return {
        help: help,
        png: png,
        filename: filename,
        output: output,
        html: html
    };
};

var main = function main() {
    readLocal('docs/usage.md').then(function (it) {
        var _getOptions = getOptions(it);

        var help = _getOptions.help;
        var filename = _getOptions.filename;
        var png = _getOptions.png;
        var output = _getOptions.output;
        var html = _getOptions.html;

        if (help) {
            console.log(it);
        } else {
            $fs.readFileAsync(filename, 'utf8').then(function (data) {
                var res = "";
                if (!html) {
                    res = _module.dia2svg(data);
                } else {
                    res = _module.dia2html(data);
                }
                if (!_.isUndefined(output)) {
                    (function () {
                        var oext = path.extname(output);
                        var oprefix = path.basename(output, oext);
                        if (html) {
                            $fs.writeFileAsync(oprefix + '.html', res, 'utf8');
                        } else {
                            (function () {
                                var output1 = oprefix + '.svg';
                                var file = $fs.writeFileAsync(output1, res, 'utf8');
                                if (png) {
                                    file.then(function () {
                                        var rp = path.dirname($fs.realpathSync(output1));
                                        return exec('inkscape --export-png ' + rp + '/' + oprefix + '.png ' + rp + '/' + output1);
                                    });
                                }
                            })();
                        }
                    })();
                } else {
                    if (png) {
                        throw "Should specify an output filename for png";
                    } else {
                        console.log(res);
                    }
                }
            });
        }
    });
};

module.exports = _.assign({
    main: main
}, _module);