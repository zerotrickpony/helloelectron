// Interfaces that are common to both the main and render processes.

export type AFN = Promise<any>;

// The interface from the render process down to the main process.
export interface MainIpc {
  getPlatformInfo(): Promise<PlatformInfo>;
  quit(relaunch: boolean): AFN;
  getTestData(): Promise<TestData>;
  setTestData(key: keyof TestData, value: any): AFN;

  // TODO - hasUpdate();
  // TODO - allowUpdate();
}

// The interface from the main process up to the browser process.
export interface BrowserIpc {
  handleQuitting(): void;
  handleFatalError(error: string): void;
  handleLog(message: string, error: string|undefined): void;
}

export interface IpcResult {
  error?: string;
  response?: any;
}

// See MainIpc.getPlatformInfo()
export interface PlatformInfo {
  appVersion: string;
  platform: string;
  updateUrl: string;
  homedir: string;  // path of the user's home directory
  argv: string[];  // the process argv, possibly overriden for testing
  cwd: string;  // the CWD of the current process
}

export class TestData {
  testName?: string;  // the currently running test, if any
  fakeArgv = new Map<string, string[]>;  // a per-test map of fake args to install
}
