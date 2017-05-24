import * as minimist from 'minimist';
import * as promisify from 'pify';
import * as fs from 'fs';
import {importFile, importers} from '@musicociel/song-formats/build/song/formats/import';
import {exportFile, exporters} from '@musicociel/song-formats/build/song/formats/export';
import {checkAndTransposeSheetMusic} from '@musicociel/song-formats/build/song/song';
import {Alteration, parseAlteration} from '@musicociel/song-formats/build/song/note';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

export async function main(argv) {
  const config = minimist(argv, {
    boolean: ['help', 'reset-alterations', 'accept-unknown-chords', 'normalize-chords'],
    string: ['input', 'input-format', 'output', 'output-format', 'alteration', 'transpose'],
    alias: {
      'input': 'i',
      'output': 'o',
      'transpose': 't',
      'alteration': 'a',
      'reset-alterations': 'r',
      'accept-unknown-chords': 'u',
      'normalize-chords': 'n'
    }
  });
  if (config.help) {
    console.log(`
Usage: musicociel song convert [options]

Available options:
 --input <file>           -i <file>      Input file
 --input-format <format>                 Input format
 --output <file>          -o <file>      Output file
 --output-format <format>                Output format
 --transpose <num>        -t <num>       Transpose up or down by the given number of semitones
 --alteration [#|b]       -a [#|b]       Whether to use # or b when needed
 --reset-alterations      -r             Resets all alterations (to use the one specified by -a)
 --accept-unknown-chords  -u             Accepts unknown chord types
 --normalize-chords       -n             Change chords to use the default name (e.g. Cm instead of C-)
 --help                                  Prints this help message and exits.

Available input formats:
 - ${importers.list.map(f => `${f.name} ${f.fileExtensions.length > 0 ? `(${f.fileExtensions.join(', ')})` : ''}`).join('\n - ')}

Available output formats:
 - ${exporters.list.map(f => `${f.name} ${f.fileExtensions.length > 0 ? `(${f.fileExtensions.join(', ')})` : ''}`).join('\n - ')}

If no explicit format is specified (through --input-format or --output-format), the format is deduced
from the file extension, if possible. Otherwise, the default input format is 'Auto' (which tries each
format in order until one succeeds reading the file), and the default output format is 'Musicociel'.
`
    );

    return 1;
  }

  let defaultAlteration;
  if (config.alteration) {
    defaultAlteration = parseAlteration(config.alteration);
    if (defaultAlteration !== -1 && defaultAlteration !== 1) {
      throw new Error(`Invalid alteration: ${config.alteration}`);
    }
  }
  let transpose;
  if (config.transpose) {
    transpose = +config.transpose;
    if (isNaN(transpose)) {
      throw new Error(`Invalid transpose parameter: ${config.transpose}`);
    }
  }

  let input;
  if (config.input) {
    input = await readFile(config.input, 'utf-8');
  } else {
    // TODO: read from stdin
    throw new Error('--input option is mandatory');
  }
  const song = importFile(input, config.input, config['input-format']);
  song.music = checkAndTransposeSheetMusic(song.music, {
    transpose: transpose,
    acceptUnknownChords: config['accept-unknown-chords'],
    skipNormalizingChordTypes: !config['normalize-chords'],
    defaultAlteration: defaultAlteration,
    resetAlterations: config['reset-alterations']
  });

  const output = exportFile(song, config.output, config['output-format']);
  if (config.output) {
    await writeFile(config.output, JSON.stringify(song));
  } else {
    console.log(output);
  }
}
