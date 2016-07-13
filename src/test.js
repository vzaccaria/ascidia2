/*eslint quotes: [0] */

"use strict"

let chai = require('chai')
chai.use(require('chai-as-promised'))
let should = chai.should()
let expect = chai.expect
let _ = require('lodash')
require('babel-polyfill')

let debug = require('debug')
let bluebird = require('bluebird')
let shelljs = require('shelljs')
let fs = require('fs')
let mm = require('mm')


var z = require('zaccaria-cli')
var promise = z.$b

/**
 * Promised version of shelljs exec
 * @param  {string} cmd The command to be executed
 * @return {promise}     A promise for the command output
 */
function exec(cmd) {
    "use strict"
    return new promise((resolve, reject) => {
        require('shelljs').exec(cmd, {
            async: true,
            silent: true
        }, (code, output) => {
            if (code !== 0) {
                reject(output)
            } else {
                resolve(output)
            }
        })
    })
}

mm.restore()

/*global describe, it, before, beforeEach, after, afterEach */

describe('#command', () => {
    "use strict";
    it('should show help', () => {
        var usage = fs.readFileSync(`${__dirname}/../docs/usage.md`, 'utf8');
        return exec(`${__dirname}/../lib/index.js -h`).should.eventually.contain(usage);
    });
})

let diatest = `
 .---------.              
 |  Server |<------.      
 '----+----'       |      
      |            |      
      | DATA CYCLE |      
      v            |      
  .-------.   .----+----. 
 | Security|  |  File   | 
 | Policy  +->| Manager | 
  '-------'   '---------' 
`;

describe('#module', () => {
    let record = {};
    let _module = require('./module');
    _module = _module({
        debug, _, shelljs, bluebird
    });
    "use strict";
    it('should try to read help on readHelp', () => {

        record = {};
        mm(shelljs, 'exec', (c, opts, cb) => {
            record.commandExecuted = c;
            cb(0, 'file contents');
        });

        return _module.readHelp().then((v) => {

            expect(record).to.contain({
                commandExecuted: "cat ../docs/usage.md"
            });
            expect(v).to.deep.equal({code: 0, stdout: 'file contents'});
        });
    });
    it('should generate svg', () => {
        expect(_module.dia2svg(diatest)).to.equal('');
    });
})
