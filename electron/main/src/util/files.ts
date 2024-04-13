import {readFileSync} from 'fs';
import {join} from 'path';

// Reads a text file expected to be bundled within the app like "lib/propertyname.txt".
export function readPackagePropertyFile(propertyName: string): string|undefined {
  try {
    const text = readFileSync(join(__dirname, 'lib', propertyName));
    return text.toString().trim();
  } catch (e) {
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
