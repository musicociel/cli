import {main as convertFile} from './song/convert-file';
import {main as importFiles} from './song/import-files';
const packageJson = require('../package.json');

const commands = {
  'song': {
    'convert-file': convertFile,
    'import-files': importFiles
  },
  'version': async () => {
    console.log(packageJson.version);
    return 0;
  }
};

export async function main(argv) {
  argv = argv.slice(0);
  let subCommands = commands;
  const pathToCmd: string[] = ['musicociel'];
  while (true) {
    const cmd = argv.shift();
    if (!cmd || cmd === 'help' || !subCommands.hasOwnProperty(cmd)) {
      console.log(`Usage: ${pathToCmd.join(' ')} [command]\n\nAvailable commands:\n - ${Object.keys(subCommands).join('\n - ')}`);
      return 1;
    }
    pathToCmd.push(cmd);
    const handler = subCommands[cmd];
    if (typeof handler === 'function') {
      return await handler(argv);
    }
    subCommands = handler;
  }
}
