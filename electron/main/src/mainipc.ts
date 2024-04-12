// Implements the IPC commands called from the renderer process.
import {app, BrowserWindow} from 'electron';
import {Main} from './electronmain';
import {MainIpc, BrowserIpc, IpcResult, PlatformInfo, TestData} from './common/schema';
import {fork} from './common/commonutil';
import {readPackagePropertyFile, getHomeDir} from './util';
import {Logger} from './logger';

// TODO - import {SelfUpdater} from './selfupdater';

// The command handler object which handles IPC requests from the Electron renderer.
export class IpcHandler implements MainIpc {
  win: BrowserWindow;
  systemTestData = new TestData();
  browserClient: BrowserIpc;
  platformInfo?: PlatformInfo;  // set on first use

  constructor(main: Main, opt_systemTestData?: TestData) {
    // TODO this.updater = new SelfUpdater(this);
    this.win = main.win;
    this.browserClient = new IpcClient(this.win);

    if (opt_systemTestData) {
      // set to empty by electronmain, filled in for automated tests
      this.systemTestData = opt_systemTestData;
    }
  }

  // Handles electron commands as if they were network requests
  async handleMainIpc(req: {command: string, args: any[]}): Promise<IpcResult> {
    const {command, args} = req;
    const handler = (this as any)[command] as (...args: any[]) => Promise<any>;
    if (!handler) {
      return {error: `No such command: ${command}`};
    }

    try {
      const fn = handler.bind(this);
      const response = await fn(...args);
      return {response};
    } catch (e) {
      const error = e.stack;
      return {error};  // util.sendIPC will rethrow this from within the render process
    }
  }

  async getPlatformInfo(): Promise<PlatformInfo> {
    Logger.log(`getPlatformInfo`);
    if (!this.platformInfo) {
      const updateUrl = readPackagePropertyFile('updateinfo.txt');

      this.platformInfo = {
        appVersion: app.getVersion(),
        updateUrl: updateUrl ?? '',
        platform: process.platform,
        homedir: getHomeDir(),
        argv: process.argv,
        cwd: process.cwd()
      }
    }
    return this.platformInfo;
  }

  async quit(relaunch: boolean = false, exitCode = 0): Promise<void> {
    if (relaunch) {
      // TODO - this.updater.relaunch();
    } else {
      app.exit(exitCode);
    }
  }

  // Same as above but is fired from the command Q handler.
  async handleQuitEvent(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.win.isDestroyed()) {
      this.browserClient.handleQuitting();
    }
    fork(x => this.quit(false));
  }

  async getTestData(): Promise<TestData> {
    return this.systemTestData;
  }

  async setTestData(property: keyof TestData, value: any): Promise<void> {
    (this.systemTestData as any)[property] = value;
  }
}

// The browser IPC client
export class IpcClient implements BrowserIpc {
  win: BrowserWindow;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  // Sends a one-shot message to the render process. No waiting for the response.
  private send(command: keyof BrowserIpc, args: any[]) {
    this.win.webContents.send('asynchronous-message', {command, args});
  }

  // Note that unlike the render IPC, the browser IPCs are blind fire so you don't get a response.
  // TODO - it would be nice to auto-generate these dispatchers since they're all the same.
  handleQuitting  (...args: any[]) {this.send('handleQuitting',   args)}
  handleFatalError(...args: any[]) {this.send('handleFatalError', args)}
  handleLog       (...args: any[]) {this.send('handleLog',        args)}
}

import 'source-map-support/register';  // TODO - is there a better way to get source map support?
