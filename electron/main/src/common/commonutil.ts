// Any async function with a specific return type.
export type AsyncFN<T> = ((...x: any[]) => Promise<T>);

// The type of the Promise(resolve) parameter.
export type Resolver<T> = (value: T | PromiseLike<T>) => void;

// An async function with no return value.
export type VoidFN = AsyncFN<void>;

// An async function with any return value.
export type AnyFN = AsyncFN<any>;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Starts an async function running "soon" and returns.
export function fork(f: (...x: any[]) => any): any {
  return setTimeout(f, 1);
}

// Runs an async function after a timeout, returning the timeout ticket.
export function delay<X>(f: (...x: any[]) => Promise<X>, timeoutMs: number): any {

  return setTimeout(() => eat(f()), timeoutMs);
}

const DO_NOTHING_FN = () => {};
const THROW_FN = (e: Error) => {console.error(e);};

// Consumes a promise without awaiting it. Used to appease the promise linter.
export function eat<X>(p: Promise<X>): void {
  p.then(DO_NOTHING_FN, THROW_FN);
}

// A simple lock that runs one waiter at a time.
export class Mutex {
  busy = false;
  queue: Resolver<any>[] = [];

  // Runs some work within the mutex.
  async run<X>(fn: AsyncFN<X>): Promise<X> {
    await this.acquire_();
    try {
      return await fn();
    } finally {
      this.release_();
    }
  }

  reset(): void {
    this.busy = false;
    this.queue = [];
  }

  async acquire_(): Promise<void> {
    while (this.busy) await new Promise(resolve => this.queue.push(resolve));
    this.busy = true;
  }

  release_(): void {
    this.busy = false;
    const awaken = this.queue.shift();
    if (awaken) {
      awaken(undefined);
    }
  }
}
