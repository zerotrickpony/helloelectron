import {readFileSync} from 'fs';
import {join} from 'path';

// Reads a text file expected to be bundled within the app like "lib/propertyname.txt".
// If this fails then we are in dev mode and not packaged.
export function readPackagePropertyFile(propertyName: string): string|undefined {
  try {
    const text = readFileSync(join(__dirname, 'lib', propertyName));
    return text.toString().trim();
  } catch (e) {
    console.error(e);  // TODO - Logger.error
    return undefined;
  }
}

// Returns the user's home directory.
export function getHomeDir(): string {
  if (process.platform == 'win32') {
    return `${process.env.HOMEDRIVE}${process.env.HOMEPATH}`;
  } else {
    return process.env.HOME ?? '';
  }
}
