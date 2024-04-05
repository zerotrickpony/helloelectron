export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Starts an async function running "soon" and returns. Is this needed?
export function fork(f: (...x: any[]) => any): any {
  return setTimeout(f, 1);
}
