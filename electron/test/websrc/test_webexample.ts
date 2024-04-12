import {BaseElectronTest} from '../src/common/commontesting';
import {DomBox} from '../../web/src/util/html';

class TestWebExample extends BaseElectronTest {
  async run(): Promise<void> {
    DomBox.onBody().add('<div style="border: 1px solid red;" />').text('Hello!');
    // throw new Error('This test fails');
  }
}

new TestWebExample('test_webexample');