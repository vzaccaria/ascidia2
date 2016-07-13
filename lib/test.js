/*eslint quotes: [0] */

"use strict";

var chai = require('chai');
chai.use(require('chai-as-promised'));
var should = chai.should();
var expect = chai.expect;
var _ = require('lodash');
require('babel-polyfill');

var debug = require('debug');
var bluebird = require('bluebird');
var shelljs = require('shelljs');
var fs = require('fs');
var mm = require('mm');

var z = require('zaccaria-cli');
var promise = z.$b;

/**
 * Promised version of shelljs exec
 * @param  {string} cmd The command to be executed
 * @return {promise}     A promise for the command output
 */
function exec(cmd) {
    "use strict";

    return new promise(function (resolve, reject) {
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

mm.restore();

/*global describe, it, before, beforeEach, after, afterEach */

describe('#command', function () {
    "use strict";

    it('should show help', function () {
        var usage = fs.readFileSync(__dirname + '/../docs/usage.md', 'utf8');
        return exec(__dirname + '/../lib/index.js -h').should.eventually.contain(usage);
    });
});

var diatest = '\n .---------.              \n |  Server |<------.      \n \'----+----\'       |      \n      |            |      \n      | DATA CYCLE |      \n      v            |      \n  .-------.   .----+----. \n | Security|  |  File   | \n | Policy  +->| Manager | \n  \'-------\'   \'---------\' \n';

describe('#module', function () {
    var record = {};
    var _module = require('./module');
    _module = _module({
        debug: debug, _: _, shelljs: shelljs, bluebird: bluebird
    });
    "use strict";
    it('should try to read help on readHelp', function () {

        record = {};
        mm(shelljs, 'exec', function (c, opts, cb) {
            record.commandExecuted = c;
            cb(0, 'file contents');
        });

        return _module.readHelp().then(function (v) {

            expect(record).to.contain({
                commandExecuted: "cat ../docs/usage.md"
            });
            expect(v).to.deep.equal({ code: 0, stdout: 'file contents' });
        });
    });
    it('should generate svg', function () {
        expect(_module.dia2svg(diatest)).to.equal('');
    });
});