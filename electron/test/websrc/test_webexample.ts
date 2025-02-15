import { sleep } from '../../main/src/common/commonutil';
import { DomBox } from '../../web/src/util/html';
import { BaseElectronTest } from '../src/common/commontesting';

class TestWebExample extends BaseElectronTest {
  async run(): Promise<void> {
    DomBox.onBody().add('<div style="border: 1px solid red;" />').text('Hello!');
    await sleep(1);
    // throw new Error('This test fails');
  }
}

new TestWebExample('test_webexample');