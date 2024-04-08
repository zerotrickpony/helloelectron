// Common code for the utility scripts in this directory.

import {spawn} from 'child_process';
import {join, dirname} from 'path';
import fs from 'fs';
import events from 'events';
import readline from 'readline';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Returns the absolute path of the given directory within ./electron.
export function projectPath(path, opt_within) {
  let subpath = '../' + path;
  if (opt_within) {
    while (opt_within.startsWith('/')) {
      opt_within = opt_within.substring(1);
    }
    subpath += opt_within;
  }
  return join(__dirname, subpath);
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

// Runs a command from the given directory.
export async function execScript(cwd, ...commandAndArgs) {
  const p = new Promise((resolve, reject) => {
    const command = commandAndArgs[0];
    const args = commandAndArgs.slice(1);
    const options = {cwd};
    const p = spawn(command, args, options);
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

// Fails if package.json can't be parsed
export function parsePackageJson() {
  const path = projectPath('main/package.json');
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch (e) {
    console.error(`Could not parse ${path}`);
    throw new Error('STOP_BUILD');
  }
}
