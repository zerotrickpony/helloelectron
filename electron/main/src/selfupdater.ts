import {readFileSync} from 'fs';
import {createHash, randomBytes} from 'crypto';
import {join} from 'path';
import {Logger} from './logger';
import fetch from 'node-fetch';
import {autoUpdater, app} from 'electron';
import http from 'http';
import {BrowserIpc} from './common/schema';

// This is the JSON we read from the file
type UpdateInfo = {url: string, sha256: string, release?: string};

type HTTPRequest = http.IncomingMessage;
type HTTPResponse = http.ServerResponse<http.IncomingMessage>;

// Downloads a zip file and replaces itself.
export class SelfUpdater {
  static FIRST_CHECK_TIME_MS = 5 * 60 * 1000;  // first check in only 5 minutes
  static CHECK_TIME_MS = 3600 * 1000;  // hourly

  ipc: BrowserIpc;  // send IPC to the render process when an update is ready
  hasUpdate = false;  // set to true once fully staged
  appVersion?: string;  // this app's version number
  updateInfoUrl?: string;  // where to look for the update info

  checkTimer?: NodeJS.Timeout;  // the setTimeout ticket of the next update check, if any

  constructor(ipc: BrowserIpc) {
    this.ipc = ipc;
    this.appVersion = this.readSelfProperty_('appversion.txt');
    this.updateInfoUrl = this.readSelfProperty_('updateinfo.txt');

    if (!this.updateInfoUrl) {
      Logger.log(`No update URL found within package, no updates will be done.`);
      return;  // this is dev mode or otherwise malformed, don't do auto-update
    }

    this.scheduleCheck(SelfUpdater.FIRST_CHECK_TIME_MS);
  }

  // Relaunches, using the auto updater if necessary.
  relaunch() {
    if (this.hasUpdate) {
      autoUpdater.quitAndInstall();
    } else {
      app.relaunch();
      app.exit();
    }
  }

  // Reads the given lib file and returns its contents as text. If this fails then we are in dev mode.
  private readSelfProperty_(filename: string): string|undefined {
    try {
      const text = readFileSync(join(__dirname, 'lib', filename));
      return text.toString().trim();
    } catch (e) {
      Logger.error(e);
      return undefined;
    }
  }

  // Sets the updater to check hourly for updates.
  private scheduleCheck(delayMs = SelfUpdater.CHECK_TIME_MS) {
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = undefined;
    }

    if (this.hasUpdate || !app.isPackaged) {
      return;  // update check is not wanted.
    }

    this.checkTimer = setTimeout(async () => {
      await this.check();
      this.scheduleCheck();  // Schedule the next check in an hour
    }, delayMs);
  }

  // Downloads the updateinfo file and performs all the download steps if possible.
  private async check() {
    const info = await this.fetchUpdateInfo_();
    if (!info) {
      return;  // Nothing to do
    }

    const buffer = await this.downloadCandidate_(info.url);
    if (!buffer) {
      return;  // Couldn't download, some error will have been logged.
    }

    if (info.sha256 != this.getSHA256_(buffer)) {
      Logger.logError(`Downloaded candidate doesn't match expected SHA256, stopping update.`);
      return;
    }

    // Okay this candidate looks good, we can give it to Squirrel on next restart.
    Logger.log(`Installing candidate...`);
    const server = new FakeSquirrelServer(buffer, info.release);
    await server.install();
    Logger.log(`Candidate is staged, will install on next restart.`);
    this.hasUpdate = true;
    this.ipc.handleUpdateReady();
  }

  // Returns the current app's update JSON, if any.
  private async fetchUpdateInfo_(): Promise<UpdateInfo|undefined> {
    if (!this.updateInfoUrl) {
      return undefined;  // we must be in dev mode
    }

    try {
      Logger.log(`Checking for update...`);
      const response = await fetch(this.updateInfoUrl);
      if (!response.ok) {
        Logger.log(`No update found.`);
        return undefined;
      }

      const info = await response.json();
      if (!info.url || !info.sha256) {
        Logger.logError(`Unexpected update info: ${JSON.stringify(info, null, 2)}`);
        return undefined;
      }
      return info;

    } catch (e) {
      return SelfUpdater.handleFetchError_(e);
    }
  }

  // Downloads the given URL and returns a byte buffer.
  private async downloadCandidate_(url: string): Promise<Buffer|undefined> {
    try {
      const response = await fetch(url);
      return Buffer.from(await response.arrayBuffer());
    } catch (e) {
      return SelfUpdater.handleFetchError_(e);
    }
  }

  // Sigh: https://github.com/node-fetch/node-fetch/blob/2.x/ERROR-HANDLING.md
  private static handleFetchError_(e: Error): undefined|never {
    if (e.name === 'AbortError' || e.name === 'FetchError') {
      Logger.error(e);
      return undefined;
    } else {
      throw e;
    }
  }

  // Returns the SHA256 of the given file, or null if no such file etc.
  private getSHA256_(buffer: Buffer): string|undefined {
    try {
      return createHash('sha256').update(buffer).digest("hex").toLowerCase();
    } catch (e) {
      return undefined;
    }
  }
}

// Implements a local server that gives Squirrel something to "download" from.
class FakeSquirrelServer {
  buffer?: Buffer;  // The entire file that we're going to feed to Squirrel, in RAM
  fakeServer?: http.Server;  // A local HTTP server that proxys the update command

  password: string;  // a fake password
  filename: string;  // filename in the format that squirrel wants to see
  fileUrl: string;
  releaseInfo?: string;

  constructor(buffer: Buffer, opt_winReleaseInfo?: string) {
    this.buffer = buffer;

    // Generate fake filename and shared password from autoupdate to the fake server.
    this.password = randomBytes(64).toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
    this.filename = this.makeFilename_(opt_winReleaseInfo);
    this.fileUrl = `/${this.filename}`;
    this.releaseInfo = opt_winReleaseInfo;

    // Give up on any errors.
    autoUpdater.on("error", (x: Error) => {
      this.closeServer_();
      Logger.error(x, `Auto-update crashed`);
    });

    // Create a server and hook in various responses
    this.fakeServer = http.createServer();
    this.fakeServer.on("request", (request, response) => this.onRequest_(request, response));
  }

  // Computes a filename to serve to squirrel; on Windows this must match the release info.
  private makeFilename_(opt_winReleaseInfo?: string): string {
    if (!opt_winReleaseInfo) {
      return `${randomBytes(64).toString("hex")}.zip`;
    }

    const parts = opt_winReleaseInfo.split(' ');
    return parts[1];
  }

  // Feeds the buffer to the updater via the proxy server.
  async install() {
    return await new Promise<void>((resolve, reject) => {
      autoUpdater.on("update-downloaded", x => {
        Logger.log(`Update staged, will install on restart`);
        this.closeServer_();
        resolve();
      });

      const authInfo = Buffer.from(`autoupdater:${this.password}`, "ascii");
      this.fakeServer!.listen(0, "127.0.0.1", () => {
        const url = this.getServerURL_();
        Logger.log(`updateserver: Proxy server for native Squirrel is listening (address=${url})`);

        const headers = {
          "Cache-Control": "no-cache",
          Authorization: `Basic ${authInfo.toString("base64")}`,
        };
        autoUpdater.setFeedURL({url, headers});
        autoUpdater.once("error", reject);

        // Trigger the update
        autoUpdater.checkForUpdates();
      });
    });
  }

  // Handles an HTTP request
  private onRequest_(request: HTTPRequest, response: HTTPResponse) {
    Logger.log(`updateserver: ${request.url} requested`);
    if (!request.url) {
      return this.serve404_(request, response);

    } else if (request.url === "/") {
      if (!this.checkAuthValid_(request, response)) return;
      // Squirrel wants to see a root response
      return this.serveRoot_(request, response);

    } else if (request.url.startsWith(`/RELEASES`)) {
      // Serve a Windows RELEASES metadata file.
      return this.serveReleases_(request, response);

    } else if (request.url.startsWith(this.fileUrl)) {
      // Glad you asked for this particular file! Here it is.
      return this.serveFile_(request, response);

    } else {
      return this.serve404_(request, response);
    }
  }

  // Returns false if the request isn't carrying the correct password.
  private checkAuthValid_(request: HTTPRequest, response: HTTPResponse): boolean {
    if (!request.headers.authorization) {
      return this.serve401_(request, response, 'No authenthication info');
    }
    if (request.headers.authorization.indexOf("Basic ") === -1) {
      return this.serve401_(request, response, 'No authenthication basic info');
    }

    const base64Credentials = request.headers.authorization.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
    const [username, password] = credentials.split(":");
    if (username !== "autoupdater" || password !== this.password) {
      return this.serve401_(request, response, '');
    }
    return true;
  }

  // Returns false if the request isn't to the correct file URL
  private checkFileURL_(request: HTTPRequest, response: HTTPResponse): boolean {
    if (!request.url || !request.url.startsWith(this.fileUrl)) {
      return this.serve404_(request, response);
    }
    return true;
  }

  serveRoot_(request: HTTPRequest, response: HTTPResponse): void {
    Logger.log(`updateserver: ${request.url} requested, serving root path`)
    const data = Buffer.from(`{ "url": "${this.getServerURL_()}${this.fileUrl}" }`);
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Length": data.length
    });
    response.end(data);
  }

  serveReleases_(request: HTTPRequest, response: HTTPResponse): void {
    Logger.log(`updateserver: ${request.url} requested, serving releases file`)
    const data = Buffer.from(`${this.releaseInfo}\n`);
    response.writeHead(200, {
      "Content-Type": "text/plain",
      "Content-Length": data.length
    });
    response.end(data);
  }

  // Serves the requested binary. Zip is the correct type for nupkg apparently
  serveFile_(request: HTTPRequest, response: HTTPResponse): void {
    Logger.log(`updateserver: ${request.url} requested, serving downloadable`)
    response.writeHead(200, {
      "Content-Type": "application/zip",
      "Content-Length": this.buffer!.length,
    });
    response.write(this.buffer);
    response.end();
  }

  // Serves a 404 and gives up
  private serve404_(request: HTTPRequest, response: HTTPResponse): false {
    Logger.log(`updateserver: ${request.url} requested, but not supported`)
    response.writeHead(404);
    response.end();
    return false;
  }

  // Serves a 401 and gives up
  private serve401_(request: HTTPRequest, response: HTTPResponse, log = 'Invalid authenthication credentials'): false {
    response.statusCode = 401;
    response.statusMessage = "Invalid Authentication Credentials";
    response.end();
    Logger.logError(`updateserver: ${log}`);
    return false;
  }

  private getServerURL_(): string {
    if (!this.fakeServer) {
      throw new Error(`Surprising URL request before server is set up`);
    }

    const address = this.fakeServer.address();
    if (typeof address === "string") {
      return address;
    } else {
      return `http://127.0.0.1:${address!.port}`;
    }
  }

  // Cleans up the fake proxy server, if any
  private closeServer_(): void {
    this.buffer = undefined;  // free memory consumed by the downloaded buffer
    if (this.fakeServer) {
      this.fakeServer.close();
      this.fakeServer = undefined;
    }
  }
}

// Returns true if we detected that we're in a squirrel installer and returns true.
export function handleSquirrelInstallerEvents() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command: string, args: string[]) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args: string[]) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit();
      return true;

    case '--squirrel-firstrun':
      app.quit();
      return true;
  }
  return false;
}
