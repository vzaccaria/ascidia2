/* eslint quotes: [0], strict: [0] */
const {
    _,
    $d,
    $o,
    $fs,
    $b,
    $s
    // $r.stdin() -> Promise  ;; to read from stdin
} = require('zaccaria-cli');

function exec(cmd) {
    "use strict";
    return new $b((resolve, reject) => {
        require('shelljs').exec(cmd, {
            async: true,
            silent: true
        }, (code, output) => {
            if (code !== 0) {
                reject(output);
            } else {
                resolve(output);
            }
        });
    });
}


const path = require('path');

const debug = require('debug');
const shelljs = $s;
const bluebird = $b;

let readLocal = f => {
    const curdir = path.dirname($fs.realpathSync(__filename));
    const filepath = path.join(curdir, `../${f}`);
    return $fs.readFileAsync(filepath, 'utf8');
}

let _module = require('./module');

_module = _module({
    debug,
    _,
    shelljs,
    bluebird
});

const getOptions = doc => {
    "use strict";
    const o = $d(doc);
    const help = $o('-h', '--help', false, o);
    const png = $o('-p', '--png', false, o);
    const html = $o('-t', '--html', false, o);
    const filename = o['INPUT'];
    const output = $o('-o', '--output', undefined, o);
    return {
        help,
        png,
        filename,
        output,
        html
    };
}

const main = () => {
    readLocal('docs/usage.md').then(it => {
        const {
            help,
            filename,
            png,
            output,
            html
        } = getOptions(it);
        if (help) {
            console.log(it);
        } else {
            $fs.readFileAsync(filename, 'utf8').then(
                (data) => {
                    let res = "";
                    if (!html) {
                        res = _module.dia2svg(data);
                    } else {
                        res = _module.dia2html(data);
                    }
                    if (!_.isUndefined(output)) {
                        const oext = path.extname(output);
                        const oprefix = path.basename(output, oext);
                        if (html) {
                            $fs.writeFileAsync(`${oprefix}.html`, res, 'utf8');
                        } else {
                            let output1 = `${oprefix}.svg`;
                            let file = $fs.writeFileAsync(output1, res, 'utf8');
                            if (png) {
                                file.then(() => {
                                    let rp = path.dirname($fs.realpathSync(output1));
                                    return exec(`inkscape --export-png ${rp}/${oprefix}.png ${rp}/${output1}`);
                                });
                            }
                        }
                    } else {
                        if (png) {
                            throw "Should specify an output filename for png";
                        } else {
                            console.log(res);
                        }
                    }
                }
            );
        }
    });
}


module.exports = _.assign({
    main
}, _module);
