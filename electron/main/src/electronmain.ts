// // TODO - updater
// // These kooky things happen when the Windows installer is running us.
// if (require('electron-squirrel-startup')) return;
// if (require('./selfupdater').handleSquirrelInstallerEvents()) return;

// Otherwise normal startup
import nodepath from 'path';
import {fileURLToPath} from 'url';
import 'better-sqlite3';

import {app, BrowserWindow, ipcMain, protocol} from 'electron';
import {IpcHandler} from './mainipc';
import {TestData} from './common/schema';
import {Logger} from './logger';

type Request = Electron.ProtocolRequest;
type Response = Electron.ProtocolResponse | string;
type ProtocolFn = (rsp: Response) => void;

let HTMLFILENAME = 'lib/electronmain.html';  // this is overridden for tests
let SYSTEMTESTDATA = new TestData();  // this filled in for testing

// __TEST_DRIVER_INJECTION_POINT__

// Configure electron
app.setName('Hello');
app.whenReady().then(() => new Main());

// The main electron app.
export class Main {
  win: BrowserWindow;
  ipc: IpcHandler;

  constructor() {
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
    win.loadFile(HTMLFILENAME);
    return win;
  }

  private logToIpc(message: string) {
      console.log(message);
      if (this.win && this.ipc && !this.ipc.win.isDestroyed()) {
        this.ipc.browserClient.handleLog(message);
      }
  }

  private logErrorToIpc(error: Error, message: string) {
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
        this.ipc.browserClient.handleLog(message);
      }
    }
  }
}

import 'source-map-support/register';  // TODO - is there a better way to get source map support?
