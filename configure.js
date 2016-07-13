var {
    generateProject
} = require('diy-build')

var path = require('path')

generateProject(_ => {

    _.babel = (dir, ...deps) => {
        var command = (_) => `./node_modules/.bin/babel ${_.source} -o ${_.product}`
        var product = (_) => `./lib/${path.basename(_.source)}`
        _.compileFiles(...([command, product, dir].concat(deps)))
    }


    _.collect("docs", _ => {
        _.cmd("./node_modules/.bin/git-hist history.md")
        _.cmd("./node_modules/.bin/mustache package.json docs/readme.md | ./node_modules/.bin/stupid-replace '~USAGE~' -f docs/usage.md > readme.md")
        _.cmd("cat history.md >> readme.md")
        _.cmd("mkdir -p ./man/man1")
        _.cmd("pandoc -s -f markdown -t man readme.md > ./man/man1/ascidia2.1")
        _.cmd("-hub cm 'update docs and history.md'")
    })

    _.collect("devloop", _ => {
        _.cmd("make buildloop &")
        _.cmd("make testloop &")
    })

    _.collect("buildloop", _ => {
        _.cmd("./node_modules/.bin/babel src -d lib --watch --presets es2015,stage-2")
    })

    _.collect("testloop", _ => {
        _.cmd("./node_modules/.bin/mocha -w ./lib/test.js")
    })

    _.collect("stoploop", _ => {
        _.cmd("-pkill -9 -f '.*mocha.*'")
        _.cmd("-pkill -9 -f '.*babel.*watch.*'")
    })

    _.collectSeq("all", _ => {
        _.collect("build", _ => {
            _.cmd("./node_modules/.bin/babel src -d lib --presets es2015,stage-2")
        })
    })

    _.collect("test", _ => {
        _.cmd("make all")
        _.cmd("./node_modules/.bin/mocha ./lib/test.js")
    })

    _.collect("update", _ => {
        _.cmd("make clean && ./node_modules/.bin/babel --presets es2015,stage-2 configure.js | node")
    });

    ["major", "minor", "patch"].map(it => {
        _.collect(it, _ => {
            _.cmd(`make all`)
            _.cmd("make docs")
            _.cmd(`./node_modules/.bin/xyz -i ${it}`)
        })
    })

})
