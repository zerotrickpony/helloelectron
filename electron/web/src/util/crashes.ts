import {DomBox} from './html';
import {fork} from '../../../main/src/common/commonutil';
import {IpcClient} from '../browseripc';

// A minimal GUI for apologizing to the user for a fatal error
export class ErrorReport {
  // Some counters that might be relevant to the crash
  static startTime = Date.now();
  static lifetimeCrashCount = 0;
  static collectionOpens = 0;
  static ipcs = 0;
  static lastLoadImageCount = 0;
  static lastLoadFolderCount = 0;
  static lastLoadOtherfileCount = 0;
  static sorts = 0;
  static reporterrors = true;  // set to false if the user doesn't want any more reports
  static report = '';  // accumulate textual reports forever
  static currentReport?: ErrorReport;  // set if the dialog is displayed

  // Dialog members
  ipc: IpcClient;
  overlay: DomBox;
  errorbox: DomBox;

  // Displays the error report for an exception, or adds this exception to the existing report.
  constructor(ipc: IpcClient, e: Error) {
    console.error(`ErrorReport was called!`);
    this.ipc = ipc;
    ErrorReport.lifetimeCrashCount++;
    if (!ErrorReport.reporterrors) {
      console.error('The app has encountered another unhandled error');
      console.error(e);
      return;
    }

    ErrorReport.report = this.toReportText(e) + '\n\n' + ErrorReport.report;
    fork(async x => await this.ipc.logCrash(ErrorReport.report));
    if (ErrorReport.currentReport) {
      ErrorReport.currentReport.update();
      return;
    }

    const what = ErrorReport.lifetimeCrashCount > 1 ? 'another' : 'an';
    this.overlay = DomBox.onBody().add('<div id=erroroverlay />');
    const div = this.overlay.add('<div class="dialog errorreport" />');
    const title = div.add('<div class=title />').text('You found a bug!');
    div.add('<div class=subtitle />').
        html(`The app has encountered ${what} unhandled error. Please let me know!
          The information below will help me debug this problem, so please click
          <b>Copy Error Report To Clipboard</b> and then paste the text into an <b>email</b> and send it to
          me. Bug reports appreciated. And, sorry about that!`);

    // Copy button
    const copyButton = div.add('<button class=copy />').
        text('Copy Error Report to Clipboard').
        click(async e => {
          await navigator.clipboard.writeText(ErrorReport.report);
          copyButton.text('Copied!');
        });

    this.errorbox = div.add('<div class=errorbox />').text(ErrorReport.report);
    const checkrow = div.add('<div class=checkboxrow />');
    const dontask = checkrow.add('<input type=checkbox id=errorreportdontaskagain />');
    checkrow.add('<label for=errorreportdontaskagain />').
        text(`Don't show this again for this session. (But like seriously, you should restart)`);
    dontask.on('input', async e => ErrorReport.reporterrors = !dontask.isChecked());
    checkrow.hide();

    div.add('<div class=next />').
        html(`Once you've reported the problem, the safest thing is to restart the app. However, if you
          are in the middle of some very precious work that you don't want to lose, you can
          <b>try</b> to keep going, at least enough to finish what you're doing.
          It might not work though! Please restart soon!`);
    const buttonbox = div.add('<div class=buttons />');
    buttonbox.add('<button class=restart />').
        text('Restart App').
        click(async e => await ipc.quit(true));
    buttonbox.add('<button class=dismiss />').
        text('Try to keep going').
        click(async e => this.dismiss());

    // A special experience for repeat crashes!
    if (ErrorReport.lifetimeCrashCount > 1) {
      title.text(`This isn't going well`);
      checkrow.show();
    }

    ErrorReport.currentReport = this;  // it me
  }

  dismiss() {
    this.overlay.remove();
    ErrorReport.currentReport = undefined;
  }

  // A second error arrived before the user dismissed us, show it
  update() {
    this.errorbox.text(ErrorReport.report);
  }

  // Composes an emailable error report from the given error
  toReportText(e: Error): string {
    let result = `APP CRASH REPORT ${ErrorReport.lifetimeCrashCount}`;
    result += `\nFMT=2`;
    const pinfo = this.ipc.getCachedPlatformInfo();
    if (pinfo) {
      result += `\nPLATFORM: ${pinfo.platform}`;
      result += `\nPFVERSION: ${pinfo.appVersion}`;
    }

    // counters
    result += `\nUPTIME=${Date.now() - ErrorReport.startTime}`;
    result += `\nCRASHCOUNT=${ErrorReport.lifetimeCrashCount}`;
    result += `\nCOLLECTIONOPENCOUNT=${ErrorReport.collectionOpens}`;
    result += `\nIPCCOUNT=${ErrorReport.ipcs}`;
    result += `\nLASTLOADIMAGECOUNT=${ErrorReport.lastLoadImageCount}`;
    result += `\nLASTLOADFOLDERCOUNT=${ErrorReport.lastLoadFolderCount}`;
    result += `\nSORTCOUNT=${ErrorReport.sorts}`;

    result += `\nRENDER TRACE:\n${e.stack}`;

    const pfError = (e as any)['pfmainError'];
    if (pfError) {
      result += `\nMAIN PROCESS TRACE:\n${pfError}`;
    }
    return result;
  }
}
