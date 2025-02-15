import { sleep } from '../../main/src/common/commonutil';
import { Logger } from '../../main/src/logger';
import { BaseElectronTest } from './common/commontesting';

class TestExample extends BaseElectronTest {
  async run(): Promise<void> {
    Logger.log(`Here's a message from the test in the main process!`);
    await sleep(1);
    //throw new Error('This test fails');
  }
}

new TestExample('test_example');
