// Logs messages and errors from the main process. When available, these are
// also forwarded to the developer console in the render process.
export class Logger {
  static GLOBAL_ERROR_HANDLER?: (e: Error, m: string) => any;  // this is hooked by Electron IPC on startup
  static GLOBAL_LOG_HANDLER?: (m: string) => any;  // this is hooked by Electron IPC on startup

  // Logs an error.
  static error(e: Error, opt_message = ''): void {
    if (Logger.GLOBAL_ERROR_HANDLER) {
      Logger.GLOBAL_ERROR_HANDLER(e, opt_message);
    } else {
      if (opt_message) {
        console.log(opt_message);
      }
      console.error(e);
    }
  }

  // Logs a non-error message.
  static log(message: string): void {
    if (Logger.GLOBAL_LOG_HANDLER) {
      Logger.GLOBAL_LOG_HANDLER(message);
    } else {
      console.log(message);
    }
  }
}
