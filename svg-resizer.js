#!/usr/bin/env node

require('shelljs/global');
const { execFileSync } = require('child_process');
var path = require('path');
var fs = require('fs-extra');
var _ = require('lodash');
var xml2js = require('xml2js');
var program = require("commander");
var builder = new xml2js.Builder();
var parseString = xml2js.parseString;

var ptToPx = function(pt) {
    return pt * dpi * (1 / 72);
};
var pxToPt = function(px) {
    return px / (dpi * (1 / 72));
};


if (!which('rsvg-convert')) {
  console.log('rsvg-convert bin from libsrvg is required');
  process.exit(1);
}

program
    .option('-x, --width <type>', 'Output svg width')
    .option('-y, --height <type>', 'Output svg height')
    .option('-f, --fit', 'Fit to specified dimensions preserving aspect ratio')
    .option('-i, --input <FILE>', 'Input svg path')
    .option('-o, --output <FILE>', 'Output svg path')
    .option('-f, --format <type>', 'Output file format', 'svg')

program.parse(process.argv);
var opts = program.opts();


// create output folder if dont exist
fs.mkdirpSync(path.join(opts.output));

var dpi = 96;
var svgFiles = [opts.input];
var finalWidth = pxToPt(opts.width || opts.height);
var finalHeight = pxToPt(opts.height || opts.width);
var finalRatio = finalWidth / finalHeight;


svgFiles.forEach(function(svgPath) {

    if (opts.fit) {
        var origWidth, origHeight;
        var newWidth, newHeight;
        var fileContent = fs.readFileSync(svgPath, 'utf8');

        parseString(fileContent, function (err, parsedFileContent) {
            origWidth = pxToPt(parseInt(parsedFileContent.svg.$.width, 10));
            origHeight = pxToPt(parseInt(parsedFileContent.svg.$.height, 10));
        });

        var origRatio = origWidth / origHeight;

        if (origRatio < finalRatio) {
            newHeight = finalHeight;
            newWidth = origWidth / (origHeight / newHeight);
            newWidth = Math.floor(newWidth);
        } else {
            newWidth = finalWidth;
            newHeight = origHeight / (origWidth / newWidth);
            newHeight = Math.floor(newHeight);
        }

        opts.width = newWidth;
        opts.height = newHeight;
    }

    // build args
    var outputPath =  opts.output ? path.join(opts.output, path.basename(svgPath, '.svg') + '.' + opts.format) : '';

    var args = _.compact([
        opts.width ? '-w ' + opts.width : null,
        opts.height ? '-h ' + opts.height : null,
        '--keep-aspect-ratio',
        '--dpi-x 90', // work with pixels
        '--dpi-y 90', // work with pixels
        '-f ' + opts.format,
        svgPath,
        '-o ' + outputPath
    ]);

    // print rsvg command
    console.log('rsvg-convert' + args.join(' '));

    // resize file with librsvg
    try{
      execFileSync('rsvg-convert ', args, {
        encoding: 'utf8'
      });
    } catch {
      console.log('Error converting file: ' + svgPath);
      return;
    }

    // read resized file and change pt to px
    var resizedFileContent = fs.readFileSync(outputPath, 'utf8');

    parseString(resizedFileContent, function (err, parsedFileContent) {
        var w = parsedFileContent.svg.$.width;
        var h = parsedFileContent.svg.$.height;

        w = w.match(/pt$/) ? ptToPx(parseInt(w, 10)) + 'px' : w;
        h = h.match(/pt$/) ? ptToPx(parseInt(h, 10)) + 'px' : h;

        parsedFileContent.svg.$.width = w;
        parsedFileContent.svg.$.height = h;
        // parsedFileContent.svg.$.viewBox = [0, 0, parseInt(w, 10), parseInt(h, 10)].join(' ');

        var finalSVG = builder.buildObject(parsedFileContent);
        fs.outputFileSync(outputPath, finalSVG);
    });

});

process.exit(0);
