/**
 * Runs tasks for the same key one after another within this process, so two requests on one
 * session never refresh its tokens at the same time. A failed task fails only its own caller:
 * the queue continues, and the queue's own bookkeeping never leaves a rejection unhandled.
 */
export function createKeyedSerialLock() {
  const tails = new Map<string, Promise<void>>();

  return async function withLock<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const run = previous.then(task);
    const tail = run.then(
      () => undefined,
      () => undefined,
    );
    tails.set(key, tail);
    void tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return run;
  };
}
