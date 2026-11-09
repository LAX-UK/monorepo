/**
 * Runs `task` once the browser has nothing better to do (or after a short delay where it cannot
 * say), and returns a function that cancels it. For work that makes a later action quicker but is
 * not needed to see or use the page, such as fetching a dialog's code.
 */
export function runWhenIdle(task: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 1500);
  return () => window.clearTimeout(id);
}
