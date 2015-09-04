/**
 * TopicMapper
 */
var _           = require('lodash');
var argv        = require('minimist')(process.argv.slice(2));
var colors      = require('colors');
var lstatSync   = require('fs').lstatSync;
var path        = require('path');
var readdirSync = require('fs').readdirSync;
var readFileSync= require('fs').readFileSync;
var sprintf     = require('sprintf-js').sprintf;
var uf          = require('util').format;

var startDir = argv.D || argv.dir || '.';
var jsonOut = argv.j || argv.json || false;
var isDebug = argv.d || argv.debug || false;

var Mapper = function () {
    this.ignoreFiles = ['.', '..'];
    this.topicMap = {};
    this.fileMap = {test: {topics_in: [], topics_out: []}};
};


Mapper.prototype = {
    processDir: function (dir) {
        var self = this;
        if (!jsonOut && isDebug) { console.log(colors.green(uf('%s', dir))); }
        var files = readdirSync(dir);
        files.forEach(function (file) {
            if (file) {
                var isDir = false;
                var fullPath = dir + '/' + file;
                if (path.extname(file) === '.json' && file.indexOf('prototype') === -1) {
                    self.processFile(fullPath);
                } else if (self.ignoreFiles.indexOf(file) === -1) {
                    try {
                        isDir = lstatSync(fullPath).isDirectory();
                    } catch (err) {
                        if (isDebug) { console.log(colors.red(uf('    Skipping %s: %s', fullPath, err.message))); }
                    }

                    if (isDir) {
                        self.processDir(fullPath);
                    }
                }
            }
        });
    },

    processFile: function (fullPath) {
        if (isDebug) { console.log(colors.cyan(uf('    Processing: %s', path.basename(fullPath)))); }
        var self = this;

        var src = readFileSync(fullPath);
        try {
            var args = JSON.parse(src.toString('utf8'));
        } catch (err) {
            if (isDebug) { console.log(colors.red(uf('    ERROR: parsing file %s', fullPath))); }
        }
        if (args) {
            self.processArgs(args, path.basename(fullPath));
        }
    },

    processArgs: function (args, configName) {
        var self = this;

        _.forEach(args, function (val, key, args) {
            _.forEach(args[key], function (itemVal, itemKey) {
                if (itemKey.indexOf && itemKey.indexOf('topic_in') >= 0) {
                    self.addToFileMap(configName, itemVal.value, 'in');
                }
                if (itemKey.indexOf && itemKey.indexOf('topic_out') >= 0) {
                    self.addToFileMap(configName, itemVal.value, 'out');
                }
            });
        });
    },

    addToFileMap: function (fileName, topic, inOrOut) {
        if (!this.fileMap[fileName]) { this.fileMap[fileName] = {topics_in: [], topics_out: []}; }
        if (!this.topicMap[topic]) { this.topicMap[topic] = {from: [], to: [] }; }
        if (inOrOut === 'in') {
            this.fileMap[fileName].topics_in.push(topic);
            this.topicMap[topic].from.push(fileName);
        } else {
            this.fileMap[fileName].topics_out.push(topic);
            this.topicMap[topic].to.push(fileName);
        }
    },

    sendJsonOutput: function () {
        var outJson = {fileMap: this.fileMap, topicMap: this.topicMap};
        console.log(JSON.stringify(outJson, null, 2));
    },

    sendConsoleOut: function () {
        console.log(colors.magenta('\nProcessing complete'));
        _.forEach(this.fileMap, function (val, key) {
            if (val.topics_in || val.topics_out) {
                console.log(colors.cyan(sprintf('Config file: %s', key)));
                if (val.topics_in && val.topics_in.length > 0) {
                    console.log(colors.green('    Receives from topic(s):'));
                    console.log(colors.green(sprintf('        %s', val.topics_in.splice(', '))));
                }
                if (val.topics_out && val.topics_out.length > 0) {
                    console.log(colors.magenta('    Sends to topics(s):'));
                    console.log(colors.magenta(sprintf('        %s', val.topics_out.splice(', '))));
                }
                console.log(' ');
            }
        });

        _.forEach(this.topicMap, function (val, key) {
            if (val.from || val.to) {
                console.log(colors.cyan(sprintf('Topic: %s', key)));
                if (val.from && val.from.length > 0) {
                    console.log(colors.green('    Entries created by:'));
                    console.log(colors.green(sprintf('        %s', val.from.splice(', '))));
                }
                if (val.to && val.to.length > 0) {
                    console.log(colors.magenta('    Entries used by:'));
                    console.log(colors.magenta(sprintf('        %s', val.to.splice(', '))));
                }
                console.log(' ');
            }
        });


    }
};

var mapper = new Mapper();

mapper.processDir(startDir);

if (jsonOut) {
    mapper.sendJsonOutput();
} else {
    mapper.sendConsoleOut();
}
