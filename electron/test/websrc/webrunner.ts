// This module runs from electronmain.html, AFTER all the tests are loaded.
import {App} from '../../web/src/app';
import {ALL_TESTS} from '../src/common/commontesting';
import {ErrorReport} from '../../web/src/util/crashes';

// Fetches the TestData by IPC and runs the desired web test, if any.
export class WebTestRunner {
  async run(): Promise<void> {
    const testData = await App.INSTANCE.ipc.getTestData();
    if (!testData.isWeb) {
      return;  // The desired test is not a renderer test, so nothing to do
    }

    const testClass = ALL_TESTS.get(testData.testName);
    if (!testClass) {
      throw new Error(`Render process test not found: ${testData.testName}, is it constructed?`);
    }

    let result = 'success';
    try {
      await testClass.run();
    } catch (e) {
      console.error(`Test FAILED: ${testData.testName}`);
      console.error(e);
      result = 'failure';
    }

    if (ErrorReport.lifetimeCrashCount > 0) {
      console.error(`Test FAILED: ${testData.testName} (crash)`);
      result = 'failure';  // if there was a crash at all, consider the test to have failed
    }

    // The main process test runner will report this result via a testresult.json file
    const w: any = window;

    if (w?.__coverage__) {
      const s = JSON.stringify(w?.__coverage__);
      await w.electronAPI.testcommand({command: 'savecoverage', args: [s]});
    }

    await w.electronAPI.testcommand({command: result, args: []});

    if (result === 'success') {
      // On a success we simply exit so we can go on to the next test.
      // This will also save main process coverage data if there was any.
      await w.electronAPI.testcommand({command: 'quit', args: []});
    }
  }
}

// TODO - we'll just run the test right away, without caring about any particular ready condition.
// it will be up to the app, and the test author, to decide when it's late enough to run.
setTimeout(async () => await new WebTestRunner().run(), 500);
