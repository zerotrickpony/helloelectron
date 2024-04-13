import {MainIpc, BrowserIpc, IpcResult, PlatformInfo, TestData} from '../../main/src/common/schema';
import {App} from './app';
import {ErrorReport} from './util/crashes';

type AFN = Promise<any>;

// The command handler object which handles IPC requests from the Electron renderer, and sends IPC requests to the server.
export class IpcHandler implements BrowserIpc {
  app: App;
  mainClient: IpcClient;

  constructor(app: App) {
    this.app = app;
    this.mainClient = new IpcClient();

    window.addEventListener('error', e => new ErrorReport(this.mainClient, e.error));
    window.addEventListener('unhandledrejection', e => new ErrorReport(this.mainClient, e.reason));
    window.addEventListener('uncaughtexception', (e: ErrorEvent) => {
      // TODO: do these happen? Or same as error?
      console.error(`uncaughtexception happened!!!1! ${e}`);
      new ErrorReport(this.mainClient, e.error);
    });

    // register for IPCs from the main process
    const w: any = window;
    w.electronAPI.handleIpc(async (command: string, args: any[]) => await this.handleIpc(command, args));
  }

  // Handles electron commands as if they were network requests
  private async handleIpc(command: string, args: any[]): Promise<void> {
    const handler = (this as any)[command] as (...args: any[]) => Promise<any>;
    if (!handler) {
      throw new Error(`No such IPC command: ${command}`);
    }

    const fn = handler.bind(this);
    await fn(...args);
  }

  // Called from the main process when we are exiting; maybe Command-Q or maybe the quit() call.
  async handleQuitting(): Promise<void> {
    console.log(`Exiting...`);
  }

  // Called when the main process crashes.
  async handleFatalError(error: string): Promise<void> {
    const e = new Error(`Main worker crash: ${error}`);
    (e as any).pfmainError = error;
    new ErrorReport(this.mainClient, e);
  }

  // Called when the main process logs something that we want to show in the console.
  handleLog(message: string, error: string): void {
    if (message) {
      console.log(message);
    }
    if (error) {
      console.error(error);
    }
  }
}

// Sends IPCs down to the main process, awaiting and returning results.
export class IpcClient implements MainIpc {
  platformInfo: PlatformInfo;  // Cached on first use

  // Sends an IPC command and returns the response.
  private async send(command: keyof MainIpc, args: any[]): Promise<any> {
    // TODO - ErrorReport.ipcs++;
    const w: any = window;
    const result = await w.electronAPI.command({command, args});
    if (result.error) {
      const e = new Error(`IPC crash: ${result.error}`);  // TODO - no need for this if ErrorReport handles the crash
      (e as any).pfmainError = result.error;
      throw e;
    }
    return result.response;
  }

  // Returns the cached platform info, if any
  getCachedPlatformInfo(): PlatformInfo|undefined {
    return this.platformInfo;
  }

  // This one is special because we also cache the platform info result.
  async getPlatformInfo(): Promise<PlatformInfo> {
    if (!this.platformInfo) {
      const info = await this.send('getPlatformInfo', []);
      if (info) {
        this.platformInfo = info;
      }
    }
    return this.platformInfo;
  }

  // TODO - it would be nice to auto-generate these dispatchers since they're all the same.
  async quit           (...args: any[]): AFN {return await this.send('quit'           , args);}
  async getTestData    (...args: any[]): AFN {return await this.send('getTestData'    , args);}
  async setTestData    (...args: any[]): AFN {return await this.send('setTestData'    , args);}
  async getRecipes     (...args: any[]): AFN {return await this.send('getRecipes'     , args);}
}
