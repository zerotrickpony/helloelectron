// // TODO
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

// const {Logger} = require('./util');

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
    process.on('unhandledRejection', (e: Error, p) => this.handleError(e));
    process.on('uncaughtException', (e) => this.handleError(e));
    app.on('before-quit', e => this.ipc.handleQuitEvent(e));
    // TODO - Logger.GLOBAL_LOG_HANDLER = m => this.handleLogToIpc_('log', m);
    // TODO - Logger.GLOBAL_ERROR_HANDLER = (e, m) => this.handleLogToIpc_('error', e, m);

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
  private handleError(e: Error) {
    // TODO - if (e && e.message && e.message == PF_CANCEL_EXCEPTION) {
    //   return;  // ignore normal cancellation exceptions
    // }

    console.error(e);
    if (this.win) {
      const error = e && e.stack ? e.stack : `${e}`;
      this.ipc.browserClient.handleError(error);
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

  private handleLogToIpc_(type: string, ...args: string[]) {
    // TODO
    console.error(`${type}: ${args}`);
    // if (type == 'error') {
    //   let [error, message] = args;
    //   if (message) {
    //     console.log(message);
    //   }
    //   if (error) {
    //     console.error(error);
    //   }
    //   if (this.server && !this.server.win.isDestroyed()) {
    //     if (error && error.stack) {
    //       error = error.stack;
    //     }
    //     this.server.sendRenderIpc('debuglog', {error, message});
    //   }
    // } else {
    //   console.log(...args);
    //   if (this.server && !this.server.win.isDestroyed()) {
    //     this.server.sendRenderIpc('debuglog', {message: args[0]});
    //   }
    // }
  }
}

import 'source-map-support/register';  // TODO - is there a better way to get source map support?
