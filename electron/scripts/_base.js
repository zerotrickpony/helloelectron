// Common code for the utility scripts in this directory.

import {spawn} from 'child_process';
import {join, dirname} from 'path';
import fs from 'fs';
import {homedir} from 'os';
import events from 'events';
import readline from 'readline';
import {fileURLToPath} from 'url';
import {createHash} from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Returns the absolute path of the given directory within ./electron.
export function projectPath(path, opt_within) {
  let subpath = '../' + path;
  if (opt_within) {
    while (opt_within.startsWith('/')) {
      opt_within = opt_within.substring(1);
    }
    subpath += '/' + opt_within;
  }
  return join(__dirname, subpath);
}

// Returns the absolute path of a file in the user's home directory.
export function homePath(path) {
  return join(homedir(), path);
}

export async function cleanOutput() {
  // Erase the entire out dir
  const outdir = join(__dirname, '../out');
  fs.rmSync(outdir, { recursive: true, force: true });
}

// Returns the lines of a file.
export async function readFileLines(path) {
  const lines = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(path),
    crlfDelay: Infinity
  });

  rl.on('line', async (line) => {
    lines.push(line);
  });
  await events.once(rl, 'close');
  return lines;
}

// Runs NPM with the given args in the given directory.
export async function execNpm(cwd, ...args) {
  if (process.platform == 'win32') {
    await execScript(cwd, 'cmd.exe', '/c', 'npm', ...args);
  } else {
    await execScript(cwd, 'npm', ...args);
  }
}

// Runs NPM with the given args in the given directory.
export async function execNpmAndGetResult(cwd, ...args) {
  if (process.platform == 'win32') {
    return await execScriptAndGetResult(cwd, 'cmd.exe', '/c', 'npm', ...args);
  } else {
    return await execScriptAndGetResult(cwd, 'npm', ...args);
  }
}

// Runs a command from the given directory.
export async function execScript(cwd, ...commandAndArgs) {
  const p = new Promise((resolve, reject) => {
    const command = commandAndArgs[0];
    const ext = process.platform == 'win32' && command.indexOf('node_modules\\.bin') ? '.cmd' : '';
    const args = commandAndArgs.slice(1);
    const options = {cwd};
    const p = spawn(`${command}${ext}`, args, options);
    p.stdout.on('data', (data) => {
      process.stdout.write(data);
    });
    p.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    p.on('close', (code) => {
      resolve({code});
    });
    p.on('error', (error) => reject({error}));
  });

  const {code} = await p;
  if (code != 0) {
    console.error(`Failed (${code}): ${commandAndArgs.join(' ')}`);
    throw new Error('STOP_BUILD');
  }
}

// Same as above, but returns stdout instead of streaming it to
export async function execScriptAndGetResult(cwd, ...commandAndArgs) {
  const buffers = [];
  const p = new Promise((resolve, reject) => {
    const command = commandAndArgs[0];
    const args = commandAndArgs.slice(1);
    const options = {cwd};
    const p = spawn(command, args, options);
    p.stdout.on('data', (data) => {
      buffers.push(data);
    });
    p.stderr.on('data', (data) => {
      process.stderr.write(data);
    });
    p.on('close', (code) => {
      resolve({code});
    });
    p.on('error', (error) => reject({error}));
  });

  const {code} = await p;
  if (code != 0) {
    console.error(`Failed (${code}): ${commandAndArgs.join(' ')}`);
    throw new Error('STOP_BUILD');
  }
  return Buffer.concat(buffers);
}

// Returns true if te given path is an existing symlink
export function isSymlinkSync(linkName) {
  try {
    fs.readlinkSync(linkName);  // throws an exception if it isn't a symlink
    return true;
  } catch (e) {
    return false;
  }
}

// Creates a symlink if it doesn't already exist
export function symlinkSync(target, linkName) {
  if (isSymlinkSync(linkName)) {
    fs.unlinkSync(linkName);
  }
  fs.symlinkSync(target, linkName);
}

// Runs the given function, detecting the special STOP_BUILD exception and exiting early.
export async function runSteps(fn) {
  try {
    await fn();
    process.exit(0);
  } catch (e) {
    if (e.message == 'STOP_BUILD') {
      process.exit(1);
      return;
    } else {
      throw e;
    }
  }
}

// Returns the absolute paths of all regular files recursively in the given directory.
export function listDirR(path) {
  const result = [];
  const rscan = p => {
    for (let f of fs.readdirSync(path + p, {withFileTypes: true})) {
      const filename = `${p}/${f.name}`;
      if (f.isDirectory()) {
        rscan(filename);
      } else {
        result.push(path + filename);
      }
    }
  };
  rscan('');
  return result;
}

// Deletes whatever is at the given path. Sync.
export function rmProjectFile(p) {
  const path = projectPath(p);
  if (isSymlinkSync(path)) {
    fs.unlinkSync(path);
  } else {
    fs.rmSync(path, {recursive: true, force: true});
  }
}

// Returns the latest mtime in milliseconds from the given list of paths, or 0 if no files were readable.
export function getHighestMtime(...paths) {
  let highestMs = 0;
  for (const path of paths) {
    highestMs = compareMtime(highestMs, path);
  }
  return highestMs;
}

// Returns the given highest mtime, or the mtime of the given path if it exists, whichever is higher.
export function compareMtime(highestMs, path) {
  try {
    const s = fs.statSync(path);
    if (s && !isNaN(s.mtimeMs) && highestMs < s.mtimeMs) {
       return s.mtimeMs;
    }
  } catch (e) {
    // Ignore
  }
  return highestMs;
}

// Parses the given tsconfig and and stats all included sources. Returns the highest mtime from those.
export function getHighestTSCMtime(tsconfigProjectPath) {
  const tsconfigfile = projectPath(tsconfigProjectPath);
  const json = parseJson(tsconfigfile);
  const cwd = dirname(tsconfigfile);
  const patterns = json.include.map(pattern => new WildcardMatcher(cwd, pattern));
  if (!patterns.length) {
    return 0;  // hmm!
  }

  const isFileMatch = (filename) => {
    for (const w of patterns) {
      if (w.isMatch(filename)) {
        return true;
      }
    }
    return false;
  };

  let highestMs = compareMtime(0, tsconfigfile);

  const rscan = p => {
    for (let f of fs.readdirSync(p, {withFileTypes: true})) {
      const bname = f.name;
      const filename = `${p}/${bname}`;
      if (f.isDirectory()) {
        rscan(filename);
      } else if (isFileMatch(filename)) {
        highestMs = compareMtime(highestMs, filename);
      }
    }
  };

  // Scan each of the roots
  const roots = patterns.map(w => w.getRootDir());
  for (const root of roots) {
    rscan(root);
  }
  return highestMs;
}

// Returns the contents of the given file as JSON, or null if not found. Still throws on parse error.
export function parseJson(filename, opt_fail) {
  let data;
  try {
    data = fs.readFileSync(filename);
  } catch (e) {
    if (opt_fail) {
      console.error(`JSON file not found: ${filename}`);
      throw new Error('STOP_BUILD');
    } else {
      return null;  // no such file, but thats ok
    }
  }

  try {
    return JSON.parse(data);
  } catch (e) {
    console.error(`Could not parse ${filename}`);
    throw new Error('STOP_BUILD');
  }
}

// Same as above, but works with a project path instead of an arbitrary file path.
export function parseProjectJson(path, opt_fail) {
  return parseJson(projectPath(path), opt_fail);
}

// Returns the full file path of the secrets file.
export function secretsPath() {
  return homePath('.helloelectron-secrets.json');
}

// Parses a JSON file of secrets in the home directory.
export function parseSecrets() {
  return parseJson(secretsPath(), true);
}

// Erases all occurrences of "sourceMappingURL" from a text file.
export function stripSourceMap(path) {
  rewriteInPlace(path, /sourceMappingURL/g, '');
}

// Performs regexp substitution in place within the given file.
export function rewriteInPlace(path, pattern, replacement) {
  const text = '' + fs.readFileSync(path);
  fs.writeFileSync(path, text.replace(pattern, replacement));
}

// Returns the trimmed contents of the given file if it exists, or '' otherwise.
export function readTextFileOr(filename) {
  const buffer = fs.readFileSync(filename);
  if (!buffer) {
    return null;
  }
  return buffer.toString().trim();
}

// Computes the SHA256 of the given file
export function getSHA256(filename) {
  return createHash('sha256').update(fs.readFileSync(filename)).digest("hex").toLowerCase();
}

// Async function that sleeps for the given number of ms.
export async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Returns the given string but escaped for use as a search literal within a regexp
export function escaperegexp(text) {
  return text.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

// sigh
export function escapeHtml(string) {
  var str = '' + string
  var match = /["'&<>]/.exec(str)

  if (!match) {
    return str
  }

  var escape
  var html = ''
  var index = 0
  var lastIndex = 0

  for (index = match.index; index < str.length; index++) {
    switch (str.charCodeAt(index)) {
      case 34: // "
        escape = '&quot;'
        break
      case 38: // &
        escape = '&amp;'
        break
      case 39: // '
        escape = '&#39;'
        break
      case 60: // <
        escape = '&lt;'
        break
      case 62: // >
        escape = '&gt;'
        break
      default:
        continue
    }

    if (lastIndex !== index) {
      html += str.substring(lastIndex, index)
    }

    lastIndex = index + 1
    html += escape
  }

  return lastIndex !== index
    ? html + str.substring(lastIndex, index)
    : html
}

class WildcardMatcher {
  constructor(cwd, pattern) {
    // Absolute-path-ified version of the pattern
    this.path = join(cwd, pattern);
    this.pattern = this.toRegexp(this.path);
  }

  toRegexp(absPattern) {
    let result = '^';
    let pos = 0;
    let nextpos = absPattern.indexOf('*', pos);
    while (nextpos != -1) {
      const s = absPattern.substring(pos, nextpos);
      const remainder = absPattern.substring(nextpos);
      result += escaperegexp(s);
      if (remainder.startsWith('**/')) {
        result += '(.+\/)?';
        pos = nextpos + 3;
      } else if (remainder.startsWith('**')) {
        result += '.*';
        pos = nextpos + 2;
      } else if (remainder.startsWith('*')) {
        result += '[^/]+';
        pos = nextpos + 1;
      }
      nextpos = absPattern.indexOf('*', pos);
    }
    result += absPattern.substring(pos);
    return new RegExp(result + '$');
  }

  // Returns the common parent directory of this wildcard.
  getRootDir() {
    let result = '';
    for (const part of this.path.split('/')) {
      if (part.indexOf('*') != -1) {
        return result;  // stop at the beginning of the wildcards
      } else if (part != '') {
        result += '/' + part;
      }
    }
    return result;
  }

  isMatch(absPath) {
    return this.pattern.test(absPath);
  }
}
