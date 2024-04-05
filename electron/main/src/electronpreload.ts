// NOTE: This file is special because it has the entire node.js context
// but it also (I think?) runs in the render process. This is used to
// register various bridge facilities like two way IPC.
import { contextBridge, ipcRenderer, webFrame } from 'electron';

type IpcFn = (command: string, args: string[]) => Promise<void>;

contextBridge.exposeInMainWorld('electronAPI',{
  command: async (req: Electron.ProtocolRequest) => await ipcRenderer.invoke('command', req),
  clearWebFrameCache: () => webFrame.clearCache(),
  handleIpc: (listenerFn: IpcFn) => {
    ipcRenderer.on('asynchronous-message', async (e, payload) => await listenerFn(payload.command, payload.args));
  }
});
