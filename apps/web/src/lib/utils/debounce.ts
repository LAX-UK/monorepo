/** Trailing-edge debounce. Returns a function that delays invocation by
 * `wait` ms. Each call resets the timer; only the most recent arguments
 * win when the timer fires.
 * * The returned function exposes a `cancel()` method to drop a pending
 * invocation — useful when unmounting React components.
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): ((...args: TArgs) => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: TArgs) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}
