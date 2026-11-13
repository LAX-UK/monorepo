/*
 * Back puts you where you were: when a row opens its record page, the list remembers its scroll
 * position and the row; coming back to the same list address with Back (or the phone's back
 * gesture) restores the scroll and marks the row. Arriving any other way (the nav, a link) starts
 * the list fresh, as people expect.
 */

/** Where the list remembers the row that was opened, for this tab only. */
export const LIST_RETURN_STORAGE_KEY = "staff.list-return";

/** A Back that arrives later than this after the history step is treated as a fresh visit. */
const POP_WINDOW_MS = 10_000;

export type ListReturn = {
  /** The list's address (path and search) when the row was opened. */
  listUrl: string;
  rowId: string;
  scrollY: number;
  /** When the row was opened (epoch ms). */
  at: number;
};

let lastPopAt = 0;
let listening = false;

/** Notes history steps (Back, Forward) so a list can tell a return from a fresh visit. */
function listenForHistorySteps() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", () => {
    lastPopAt = Date.now();
  });
}

export function currentListUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Called as a row opens its record: remembers the list's scroll and the row. */
export function rememberListReturn(rowId: string): void {
  listenForHistorySteps();
  const entry: ListReturn = {
    listUrl: currentListUrl(),
    rowId,
    scrollY: Math.round(window.scrollY),
    at: Date.now(),
  };
  try {
    storage()?.setItem(LIST_RETURN_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Storage full or blocked: Back still works, only the scroll is not restored.
  }
}

/** True when this page was reached by a history step after the row was opened. */
function arrivedByHistoryStep(entry: ListReturn): boolean {
  if (Date.now() - lastPopAt < POP_WINDOW_MS && lastPopAt >= entry.at) return true;
  // A full page load (the record page was a hard navigation): the browser's own Back.
  if (typeof performance === "undefined" || performance.timeOrigin < entry.at) return false;
  const [navigation] = performance.getEntriesByType?.("navigation") ?? [];
  return (navigation as PerformanceNavigationTiming | undefined)?.type === "back_forward";
}

/**
 * The remembered row for this list, once: it is forgotten as it is read, so a later visit to the
 * list starts fresh. Null when the list was not reached by Back from one of its rows.
 */
export function takeListReturn(): ListReturn | null {
  listenForHistorySteps();
  const store = storage();
  const raw = store?.getItem(LIST_RETURN_STORAGE_KEY);
  if (!raw) return null;
  let entry: ListReturn;
  try {
    entry = JSON.parse(raw) as ListReturn;
  } catch {
    store?.removeItem(LIST_RETURN_STORAGE_KEY);
    return null;
  }
  if (entry.listUrl !== currentListUrl()) return null;
  store?.removeItem(LIST_RETURN_STORAGE_KEY);
  return arrivedByHistoryStep(entry) ? entry : null;
}

/** Starts listening for history steps; a list calls it as it mounts. */
export function watchListReturns(): void {
  listenForHistorySteps();
}

/** Test seam: forget the last history step. */
export function resetListReturnForTests(): void {
  lastPopAt = 0;
}
