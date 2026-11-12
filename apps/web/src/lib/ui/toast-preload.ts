import { runWhenIdle } from "@/lib/ui/run-when-idle";

type SaveDataConnection = { saveData?: boolean; effectiveType?: string };

/** Data savers and 2g connections keep the toast's code out until a toast is raised. */
function connectionIsConstrained(): boolean {
  const connection = (navigator as Navigator & { connection?: SaveDataConnection }).connection;
  if (!connection) return false;
  return connection.saveData === true || /(^|-)2g$/.test(connection.effectiveType ?? "");
}

/**
 * Fetches the toast's code once the page has loaded and the browser is idle, so the first toast
 * (a bid confirmation, say) shows as fast as it did when the code shipped with the page. The
 * code is not part of the page's first load. Returns a function that cancels the wait.
 */
export function preloadToastWhenIdle(preload: () => void): () => void {
  if (typeof window === "undefined" || connectionIsConstrained()) return () => {};
  let cancelIdle: () => void = () => {};
  let cancelled = false;
  const start = () => {
    if (!cancelled) cancelIdle = runWhenIdle(preload);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", start);
    cancelIdle();
  };
}
