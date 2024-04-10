import {BaseElectronTest} from '../src/common/commontesting';
import {HtmlBuilder} from '../../web/src/util/html';

class TestWebStart extends BaseElectronTest {
  async run(): Promise<void> {
    HtmlBuilder.onBody().add('<div style="border: 1px solid red;" />').text('Hello!');
    throw new Error('This test fails');
  }
}

new TestWebStart();