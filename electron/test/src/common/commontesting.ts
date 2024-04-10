// Testing code that can be shared between the main and render test processes.

// Central registry for all tests in this process. There are two of these, one for render and one for main.
export const ALL_TESTS = new Map<string, BaseElectronTest>();

// Base class for all runnable tests. These register themselves on creation and
// then are run by the testing harness.
export abstract class BaseElectronTest {
  name: string;

  constructor() {
    this.name = this.constructor.name;
    if (ALL_TESTS.get(this.name)) {
      throw new Error(`Duplicate test name "${this.name}" detected; please give every test a unique name.`);
    }
    ALL_TESTS.set(this.name, this);
    console.log(`Registered test: ${this.name}`);
  }

  // Runs the test. Any exception thrown is a failure, otherwise the test passes.
  abstract run(): Promise<void>;
}
