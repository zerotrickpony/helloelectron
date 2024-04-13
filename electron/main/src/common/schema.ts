// Interfaces that are common to both the main and render processes.

// The interface from the render process down to the main process.
export interface MainIpc {
  getPlatformInfo(): Promise<PlatformInfo>;
  quit(relaunch: boolean, exitCode: number): Promise<void>;
  getTestData(): Promise<TestData>;
  setTestData(key: keyof TestData, value: any): Promise<void>;
  getRecipes(): Promise<RecipeRow[]>;
  logCrash(report: string): Promise<void>;

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
  argv: string[];  // the process argv
  cwd: string;  // the CWD of the current process
}

// During tests, this informs the WebRunner of which test to run. Can attach other details here too.
export class TestData {
  testName?: string;  // The current web test name to launch, if any
  isWeb = false;  // True if the current test to run is in the renderer process
}

// A demo type
export interface RecipeRow {
  id: number,
  name: string,
  text: string
};
