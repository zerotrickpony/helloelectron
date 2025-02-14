// import { sleep } from '../../main/src/common/commonutil';
import {IpcHandler, IpcClient} from './browseripc';

export class App {
  static INSTANCE: App;

  ipcHandler: IpcHandler;
  ipc: IpcClient;

  constructor() {
    if (App.INSTANCE) {
      throw new Error(`Duplicate construction of App instance`);
    }
    App.INSTANCE = this;
    this.ipcHandler = new IpcHandler(this);
    this.ipc = this.ipcHandler.mainClient;
  }

  async run() {
    const info = await this.ipc.getPlatformInfo();
    const recipes = await this.ipc.getRecipes();
    $('BODY').append('<div id=main />');
    $('#main').text(`
      \nPlatform info:
      \n${JSON.stringify(info, null, 2)}

      \nRecipes:
      \n${JSON.stringify(recipes, null, 2)}`);
  }
}
