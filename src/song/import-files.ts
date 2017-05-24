import * as minimist from 'minimist';
import * as promisify from 'pify';
import * as fs from 'fs';
import * as PouchDB from 'pouchdb-node';
import * as globby from 'globby';
import {importFile} from '@musicociel/song-formats/build/song/formats/import';
import {songToPouchDBEntry} from '@musicociel/song-formats/build/song/pouchdb';
import {checkAndTransposeSheetMusic} from '@musicociel/song-formats/build/song/song';
import {Alteration, parseAlteration} from '@musicociel/song-formats/build/song/note';

const readFile = promisify(fs.readFile);

export async function main(argv) {
  const config = minimist(argv, {
    boolean: ['help', 'delete-others'],
    string: ['input-format', 'output-database'],
    alias: {
      'output-database': 'o'
    }
  });

  if (config.help) {
    console.log(`
Usage: musicociel song import-files [options] <files...>

  <files...>                             Files to import in database (can be patterns
                                         to match multiple files).

Available options:
 --help                                  Prints this help message and exits.
 --output-database <url>                 URL of the database to connect to.
 --input-format <format>                 Format to use when importing files.
 --delete-others                         Delete all the other songs in database.
`
    );

    return 1;
  }


  const outputDatabase = config['output-database'];
  if (!outputDatabase) {
    throw new Error('--output-database option is mandatory');
  }

  const files = await globby(config._, {
    nodir: true
  });
  const inputFormat = config['input-format'];

  const db = new PouchDB(outputDatabase);

  const ids = config['delete-others'] ? new Set<string>() : null;

  for (const fileName of files) {
    console.log(`Importing ${fileName} ...`);
    const fileContent = await readFile(fileName, 'utf-8');
    const song = importFile(fileContent, fileName, inputFormat);
    const dbEntry = songToPouchDBEntry(song);
    if (ids) {
      ids.add(dbEntry._id);
    }
    try {
      await db.put(dbEntry);
    } catch (e) {
      // ignore conflicts, as they usually mean the file was already imported
      // in the database
      if (e.name !== 'conflict') {
        throw e;
      }
    }
  }

  if (ids) {
    const allDocsResponse = await db.allDocs({
      startkey: 'song\u0000',
      endkey: 'song\u0000\uffff',
    });
    const rows = allDocsResponse.rows;
    for (const row of rows) {
      const id = row.id;
      if (!ids.has(id)) {
        console.log(`Deleting: ${id}`);
        // extra song
        await db.put({
          _id: id,
          _rev: row.value.rev,
          _deleted: true,
          type: 'song'
        });
      }
    }
  }

}
