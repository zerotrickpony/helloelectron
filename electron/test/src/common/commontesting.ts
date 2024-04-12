// Testing code that can be shared between the main and render test processes.

// Central registry for all tests in this process. There are two of these, one for render and one for main.
export const ALL_TESTS = new Map<string, BaseElectronTest>();

// Base class for all runnable tests. These register themselves on creation and
// then are run by the testing harness.
export abstract class BaseElectronTest {
  moduleName: string;
  testName: string;

  // Pass the basename of your test module, like "test_example" here.
  constructor(moduleName: string) {
    this.moduleName = moduleName;
    this.testName = this.constructor.name;
    if (ALL_TESTS.get(this.moduleName)) {
      throw new Error(`Duplicate test "${this.moduleName}" detected; please put each test in its own file.`);
    }
    ALL_TESTS.set(this.moduleName, this);
  }

  // Runs the test. Any exception thrown is a failure, otherwise the test passes.
  abstract run(): Promise<void>;
}
