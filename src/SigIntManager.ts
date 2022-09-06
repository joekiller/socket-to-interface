import readline from 'readline';

export default class SigIntManager {
  private readonly rl: readline.Interface | undefined;
  private userHandleSigInt: (() => Promise<number>) | undefined;
  constructor() {
    if (process.platform === 'win32') {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      this.rl.on('SIGINT', function () {
        process.emit('SIGINT');
      });
    }

    process.on('SIGINT', () => {
      this.handleSigInt().catch((e) => this.onFatalError(e));
    });
  }

  private async handleSigInt(): Promise<void> {
    let shouldExit = true;
    let exitCode = 0;
    if (this.userHandleSigInt) {
      const userExitCode = await this.userHandleSigInt();
      if (userExitCode > -1) {
        exitCode = userExitCode;
        shouldExit = true;
      } else {
        shouldExit = false;
      }
    }
    if (shouldExit) {
      if (this.rl) {
        this.rl.pause();
      }
      process.exit(exitCode);
    }
  }

  /**
   * set a custom async function to call on SIGINT. If the program should
   * exit return a number zero or greater. return -1 if the program should not
   * exit
   * @param fn a custom async function to run on SIGINT
   */
  public onSigInt(fn: () => Promise<number>): void {
    this.userHandleSigInt = fn;
  }

  public onFatalError(e: unknown): void {
    console.error('Fatal Error', e);
    if (this.rl) {
      this.rl.pause();
    }
    process.exit(1);
  }
}
