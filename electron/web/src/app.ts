// import { sleep } from '../../main/src/common/commonutil';
import {IpcHandler, IpcClient} from './browseripc';


export class App {
  ipcHandler: IpcHandler;
  ipc: IpcClient;

  constructor() {
    this.ipcHandler = new IpcHandler(this);
    this.ipc = this.ipcHandler.mainClient;
  }

  async run() {
    const info = await this.ipc.getPlatformInfo();
    $('BODY').append('<div id=main />');
    $('#main').text(`Platform info:\n${JSON.stringify(info, null, 2)}`);
  }
}
