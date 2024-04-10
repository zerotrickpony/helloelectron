import {BaseElectronTest} from './common/commontesting';
import {Logger} from '../../main/src/logger';

class TestStart extends BaseElectronTest {
  async run(): Promise<void> {
    Logger.log(`Here's a message from the test in the main process!`);
    throw new Error('This test fails');
  }
}

console.log(`main process TestStart has been loaded`);

new TestStart();
