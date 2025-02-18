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

  rl.on('line', (line) => {
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
  await spawnScript(cwd, commandAndArgs, p => {
    p.stdout.pipe(process.stdout);
    p.stderr.pipe(process.stderr);
  });
}

// Same as above, but returns stdout instead of streaming it to
export async function execScriptAndGetResult(cwd, ...commandAndArgs) {
  const buffers = [];
  await spawnScript(cwd, commandAndArgs, p => {
    p.stderr.pipe(process.stderr);
    p.stdout.on('data', (data) => {
      buffers.push(data);
    });
  });
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

// Same as listDirR but lists multiple directories, and assumes these are project paths.
export function listProjectDirs(...projectPaths) {
  const result = [];
  for (const p of projectPaths) {
    result.push(...listDirR(projectPath(p)));
  }
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
      const filename = join(p, bname);
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

// Returns true if the given project path exists at all.
export function projectPathExists(relpath) {
  try {
    const s = fs.statSync(projectPath(relpath));
    return !!s;
  } catch (e) {
    // Ignore
  }
  return false;
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

// Matches paths to a shell style wildcard like "foo/*.ts" or "foo/**/*.txt".
export class WildcardMatcher {
  constructor(cwd, pattern) {
    // Absolute-path-ified version of the pattern
    this.isWin = process.platform == 'win32';
    this.path = join(cwd, pattern);
    this.pattern = this.toRegexp(this.path);
  }

  // Converts a shell pattern like C:\foo\**\*.ts into a regex like /C:\\foo\\(.*)...etc
  toRegexp(absPattern) {
    const isWin = this.isWin;
    let result = '^';
    let pos = 0;
    let nextpos = absPattern.indexOf('*', pos);
    while (nextpos != -1) {
      const s = absPattern.substring(pos, nextpos);
      const remainder = absPattern.substring(nextpos);
      result += escaperegexp(s);
      if (!isWin && remainder.startsWith('**/')) {
        result += '(.+/)?';
        pos = nextpos + 3;
      } else if (isWin && remainder.startsWith('**\\')) {
        result += '(.+\\\\)?';
        pos = nextpos + 3;
      } else if (remainder.startsWith('**')) {
        result += '.*';
        pos = nextpos + 2;
      } else if (remainder.startsWith('*')) {
        result += !isWin ? '[^/]+' : '[^\\\\]+';
        pos = nextpos + 1;
      }
      nextpos = absPattern.indexOf('*', pos);
    }
    result += escaperegexp(absPattern.substring(pos));
    return new RegExp(result + '$');
  }

  // Trims off the wildcard portion of the path.
  getRootDir() {
    const path = this.path;
    const starpos = path.indexOf('*');
    const lpath = starpos != -1 ? path.substring(0, starpos) : path;
    const slashpos = lpath.lastIndexOf(this.isWin ? '\\' : '/');
    return slashpos != -1 ? lpath.substring(0, slashpos) : lpath;
  }

  isMatch(absPath) {
    return this.pattern.test(absPath);
  }
}

// Spawns the given command, runs the given setup function, and fails with STOP_BUILD if the command isn't successful.
async function spawnScript(cwd, commandAndArgs, setupFn) {
  const command = commandAndArgs[0];
  const args = commandAndArgs.slice(1);
  const ext = (process.platform == 'win32' && command.indexOf('node_modules\\.bin') != -1) ? '.cmd' : '';
  const options = {cwd};
  const s = new Spawner(`${command}${ext}`, args, options);
  s.start(setupFn);

  const code = await s.getResult();
  if (code != 0) {
    console.error(`Failed (${code}): ${commandAndArgs.join(' ')} - (cwd=${cwd})`);
    throw new Error('STOP_BUILD');
  }
}

// This is a copy-paste of main/util/Spawner.
export class Spawner {
  constructor(command, args, opt_options) {
    this.command = command;  // string
    this.args = args;  // string[]
    this.options = opt_options;  // {}

    // Waiters
    this.exitPromiseResolves = [];
    this.exitPromiseRejects = [];

    // Results
    this.childProcess = undefined;
    this.code = undefined;
    this.err = undefined;
  }

  // Starts spawn(), registers handlers, and optionally lets the caller do more process setup via a callback. Never throws.
  start(opt_setupFn) {
    try {
      this.childProcess = spawn(this.command, this.args, this.options);
      this.childProcess.on('error', err => this.onError_(err));
      this.childProcess.on('close', code => this.onClose_(code));
      if (opt_setupFn) {
        opt_setupFn(this.childProcess);
      }
    } catch (e) {
      this.onError_(e);
    }
    return this.childProcess;
  }

  // Returns the child process, or throws whatever error occurred at this point.
  getProcess() {
    if (this.err !== undefined) {
      throw this.err;
    } else if (!this.childProcess) {
      throw new Error(`Could not spawn process: ${this.command}`);
    }
    return this.childProcess;
  }

  // Returns a promise that resolves when the process has exited. Throws an Error on any problem. In order to
  // handle this correctly you must DIRECTLY await this call. The event handler must not run before your await.
  async getResult() {
    return new Promise((resolve, reject) => {
      if (this.err !== undefined) {
        reject(this.err);  // already gave an error
      } else if (this.code !== undefined) {
        resolve(this.code);  // already done
      } else {
        // No result yet, wait for it
        this.exitPromiseResolves.push(resolve);
        this.exitPromiseRejects.push(reject);
      }
    });
  }

  // Same as above except if the process has any non-zero exit, an Error is thrown with the given message.
  async expectExit0(errorMessage) {
    const code = await this.getResult();
    if (code !== 0) {
      throw new Error(errorMessage);
    }
  }

  // Called when there is an error. Any promises pending or made in the future WILL reject.
  onError_(err) {
    this.err = err;

    // Notify any waiters, and clears the lists so we don't notify anyone twice.
    const rejects = this.exitPromiseRejects;
    this.exitPromiseResolves = [];
    this.exitPromiseRejects = [];
    for (const rej of rejects) {
      try {
        rej(err);
      } catch (e) {
        console.error(`Unexpected error while delivering reject`);
      }
    }
  }

  // Called when the process ends or if there is an error.
  onClose_(code) {
    this.code = code;

    if (this.err !== undefined) {
      // We already rejected the promise, so we can store the code but we won't send it to anyone.
      return;
    }

    // Also notify any waiters, and clears the lists so we don't notify anyone twice.
    const resolves = this.exitPromiseResolves;
    this.exitPromiseResolves = [];
    this.exitPromiseRejects = [];

    for (const res of resolves) {
      try {
        res(code);
      } catch (e) {
        console.error(`Unexpected error while delivering resolve`);
      }
    }
  }
}
