import {BaseElectronTest} from './common/commontesting';
import {Logger} from '../../main/src/logger';

class TestExample extends BaseElectronTest {
  async run(): Promise<void> {
    Logger.log(`Here's a message from the test in the main process!`);
    //throw new Error('This test fails');
  }
}

new TestExample('test_example');
