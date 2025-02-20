// Implements the IPC commands called from the renderer process.
import {app, BrowserWindow} from 'electron';
import type {Main} from './electronmain';
import {MainIpc, BrowserIpc, IpcResult, PlatformInfo, TestData, RecipeRow} from './common/schema';
import {fork} from './common/commonutil';
import {readPackagePropertyFile, getHomeDir} from './util/files';
import {SelfUpdater} from './selfupdater';
import {Logger} from './logger';
import {DemoDB} from './demodb';

// TODO - import {SelfUpdater} from './selfupdater';

// The command handler object which handles IPC requests from the Electron renderer.
export class IpcHandler implements MainIpc {
  main: Main;
  win: BrowserWindow;
  db: DemoDB;
  systemTestData = new TestData();
  browserClient: BrowserIpc;
  updater: SelfUpdater;
  platformInfo?: PlatformInfo;  // set on first use

  constructor(main: Main, opt_systemTestData?: TestData) {
    // TODO this.updater = new SelfUpdater(this);
    this.main = main;
    this.win = main.win!;
    this.browserClient = new IpcClient(this.win);
    this.db = main.db;
    this.updater = new SelfUpdater(this.browserClient);

    if (opt_systemTestData) {
      // set to empty by electronmain, filled in for automated tests
      this.systemTestData = opt_systemTestData;
    }
  }

  // Handles electron commands as if they were network requests
  async handleMainIpc(req: {command: string, args: any[]}): Promise<IpcResult> {
    const {command, args} = req;
    const handler = (this as any)[command] as (...args: any[]) => Promise<any>;
    if (!handler) {  // eslint-disable-line
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

  // Returns a report of all the recipes in the demo database
  async getRecipes(): Promise<RecipeRow[]> {
    if (!this.db.isConnected()) {
      Logger.log(`Connecting to database...`);
      await this.db.connect();
    }
    const recipes = await this.db.getRecipes();
    if (recipes.length < 1) {
      // Aww we feel bad that there's no recipes yet. Let's start you off.
      await this.db.addRecipe('First Recipe', `For this you'll need water.`);
    }
    return await this.db.getRecipes();
  }

  async getPlatformInfo(): Promise<PlatformInfo> {  // eslint-disable-line @typescript-eslint/require-await
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

  async quit(relaunch = false, exitCode = 0): Promise<void> {  // eslint-disable-line @typescript-eslint/require-await
    if (relaunch) {
      this.updater.relaunch();
    } else {
      app.exit(exitCode);
    }
  }

  // Called when the render process traps a crash
  async logCrash(report: string): Promise<void> {  // eslint-disable-line @typescript-eslint/require-await
    this.main.countCrash();
    console.error(report);
  }

  // Same as above but is fired from the command Q handler.
  handleQuitEvent(e: Event): void {
    e.preventDefault();
    if (!this.win.isDestroyed()) {
      this.browserClient.handleQuitting();
    }
    fork(() => this.quit(false));
  }

  async getTestData(): Promise<TestData> {  // eslint-disable-line @typescript-eslint/require-await
    return this.systemTestData;
  }

  async setTestData(property: keyof TestData, value: any): Promise<void> {  // eslint-disable-line @typescript-eslint/require-await
    (this.systemTestData as any)[property] = value;
  }
}

// IPC client for sending messages up to the render process.
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
  handleQuitting   (...args: any[]) {this.send('handleQuitting',    args)}
  handleFatalError (...args: any[]) {this.send('handleFatalError',  args)}
  handleLog        (...args: any[]) {this.send('handleLog',         args)}
  handleUpdateReady(...args: any[]) {this.send('handleUpdateReady', args)}
}
