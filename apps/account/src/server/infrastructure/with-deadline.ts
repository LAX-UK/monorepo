/**
 * Bounds a whole call to a product, token exchange included, because the exchange has no abort
 * signal of its own. The signal also cancels the HTTP request when the deadline passes.
 */
export function withDeadline<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const deadline = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("deadline")), {
      once: true,
    });
  });
  return Promise.race([run(controller.signal), deadline]).finally(() => clearTimeout(timer));
}
