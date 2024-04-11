// This module runs from electronmain.js, BEFORE anything including the app definition.

import {readFileSync, writeFileSync} from 'fs';
import {join} from 'path';
import {TestData, IpcResult} from '../../main/src/common/schema';
import {Logger} from '../../main/src/logger';
import {ALL_TESTS} from './common/commontesting';
import {Main, SYSTEMTESTDATA} from '../../main/src/electronmain';
import {ipcMain} from 'electron';

// This runner executes the tests intended for the main process, and responds to test IPCs.
export class TestRunner {
  testData: TestData;

  // Loads the current test from the "testrunnerinfo.json" file, which "builder.js test" puts there.
  constructor(t: TestData) {
    this.testData = t;
    const path = join(__dirname, '../testrunnerinfo.json');
    const runnerData: any = JSON.parse(readFileSync(path).toString());
    t.testName = runnerData['testName'];
    t.isWeb = runnerData['isWeb'];

    if (!t.testName) {
      throw new Error(`Malformed test runner info: ${path}`);
    }
    if (!t.isWeb) {
      if (!ALL_TESTS.get(t.testName)) {
        throw new Error(`Main process test not found: ${t.testName} in runner info: ${path}`);
      }
    }

    // Listen for test commands from the web runner
    ipcMain.handle('testcommand', async (e, req) => await this.handleTestIpc(req));
  }

  // If a main process test is requested, launches it.
  async run(): Promise<void> {
    if (this.testData.isWeb) {
      return;  // do nothing, the render process runner will do the work instead.
    }

    let result = 'success';
    const testName = this.testData.testName!;
    const testClass = ALL_TESTS.get(testName)!;
    try {
      await testClass.run();
    } catch (e) {
      Logger.error(e, `Test FAILED: ${testName}`);
      result = 'failure';
    }

    // Write out a status file with the result.
    writeFileSync(join(__dirname, '../testresult.json'), JSON.stringify({testName, result}));

    if (result === 'success') {
      // On a success we simply exit so we can go on to the next test.
      Main.INSTANCE.ipc.quit(false);
    }
  }

  // Called by the web runner (or maybe some other test utility code?)
  private async handleTestIpc(req: {command: string, args: any[]}): Promise<IpcResult> {
    if (req.command === 'failure' || req.command === 'success') {
      // Write out the status for the currently running test
      const testName = this.testData.testName;
      const result = req.command;
      writeFileSync(join(__dirname, '../testresult.json'), JSON.stringify({testName, result}));
      return {response: true};

    } else {
      throw new Error(`Unexpected test command: ${req.command}`);
    }
  }
}

const runner = new TestRunner(SYSTEMTESTDATA);

// TODO - we'll just run the test right away, without caring about any particular ready condition.
// it will be up to the app, and the test author, to decide when it's late enough to run.
setTimeout(async () => await runner.run(), 500);
