// Note, these need to go at the top before other code runs, because they early exit.
import winSquirrel from 'electron-squirrel-startup';
if (winSquirrel) {
  process.exit(0);  // This only happens when the Squirrel Windows installer is running us.
}
import {handleSquirrelInstallerEvents} from './selfupdater';
if (handleSquirrelInstallerEvents()) {
  process.exit(0);  // This only happens when the Squirrel Windows installer is running us.
}

// Otherwise normal startup
import 'source-map-support/register';  // This is needed to fix source maps in node.js stack traces
import nodepath from 'path';
import {fileURLToPath} from 'url';
import {DemoDB} from './demodb';

import {app, BrowserWindow, ipcMain, protocol} from 'electron';
import {IpcHandler} from './mainipc';
import {TestData} from './common/schema';
import {Logger} from './logger';

type Request = Electron.ProtocolRequest;
type Response = Electron.ProtocolResponse | string;
type ProtocolFn = (rsp: Response) => void;

export const SYSTEMTESTDATA = new TestData();  // this filled in for testing

// __TEST_DRIVER_INJECTION_POINT__

// Configure electron
app.setName('Hello');
app.whenReady().then(() => new Main());

// The main electron app.
export class Main {
  static INSTANCE: Main;
  static lifetimeCrashCount = 0;

  win: BrowserWindow;
  ipc: IpcHandler;
  db: DemoDB;

  constructor() {
    if (Main.INSTANCE) {
      throw new Error(`Duplicate instance constructed`);
    }
    Main.INSTANCE = this;

    // Register protocols and app hooks
    protocol.registerFileProtocol('electronresource', (req, fn) => this.serveResource(req, fn));
    ipcMain.handle('command', async (e, req) => await this.ipc.handleMainIpc(req));
    process.on('unhandledRejection', (e: Error, p) => this.handleFatalError(e));
    process.on('uncaughtException', (e) => this.handleFatalError(e));
    app.on('before-quit', e => this.ipc.handleQuitEvent(e));
    Logger.GLOBAL_LOG_HANDLER = m => this.logToIpc(m);
    Logger.GLOBAL_ERROR_HANDLER = (e, m) => this.logErrorToIpc(e, m);

    // Launch the window
    this.win = this.createWindow();
    this.db = new DemoDB(nodepath.join(__dirname, 'demodb.db'));
    this.ipc = new IpcHandler(this, SYSTEMTESTDATA);
  }

  // Serves static resource files that are part of the app, like icons
  private serveResource(request: Request, callback: ProtocolFn) {
    const absPath = nodepath.join(__dirname, request.url.slice('electronresource://'.length));
    const filePath = fileURLToPath(`file://${absPath}`);
    callback(filePath);
  }

  // Called un unhandled exceptions or promise rejections
  private handleFatalError(e: Error) {
    // TODO - if (e && e.message && e.message == PF_CANCEL_EXCEPTION) {
    //   return;  // ignore normal cancellation exceptions
    // }

    Main.lifetimeCrashCount++;
    console.error(e);
    if (this.win) {
      const error = e && e.stack ? e.stack : `${e}`;
      this.ipc.browserClient.handleFatalError(error);
    }
  }

  private createWindow(): BrowserWindow {
    const win = new BrowserWindow({
      icon: nodepath.join(__dirname, 'web/appicon.png'),
      webPreferences: {
        preload: nodepath.join(__dirname, './electronpreload.js'),
      },
    });

    win.setBackgroundColor('#000');
    win.maximize();
    win.loadFile('web/electronmain.html');
    return win;
  }

  private logToIpc(message: string) {
      console.log(message);
      if (this.win && this.ipc && !this.ipc.win.isDestroyed()) {
        this.ipc.browserClient.handleLog(message, undefined);
      }
  }

  private logErrorToIpc(error?: Error, message?: string) {
    if (message) {
      console.log(message);
    }
    if (error) {
      console.error(error);
    }
    if (this.win && this.ipc && !this.ipc.win.isDestroyed()) {
      if (error && error.stack) {
        this.ipc.browserClient.handleLog(message, error.stack);
      } else {
        this.ipc.browserClient.handleLog(message, undefined);
      }
    }
  }

  countCrash() {
    Main.lifetimeCrashCount++;
  }
}
