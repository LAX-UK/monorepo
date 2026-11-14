/*
 * Back puts you where you were: when a row opens its record page, the list marks its own
 * history entry with the scroll position and the row. Coming back to that entry (Back, the
 * phone's back gesture, or a reload of it) restores the scroll and marks the row. A fresh visit
 * to the list (the nav, a link) is a new entry without the mark, so it starts fresh, as people
 * expect.
 *
 * The mark lives in `history.state`, beside a router's own state (Next.js keeps keys it does not
 * own on Back). A router that fetches the page again after Back can still rewrite the entry
 * without it before the list mounts, so the mark is also kept in session storage and used only
 * when the list was reached by Back or Forward to the same address moments before.
 */

/** The key in `history.state` that holds the row a list opened. */
export const LIST_RETURN_STATE_KEY = "__staffListReturn";

export type ListReturn = {
  rowId: string;
  scrollY: number;
};

type HistoryState = Record<string, unknown> | null;

/** Session storage key for the copy of the mark, with the list address it belongs to. */
export const LIST_RETURN_STORAGE_KEY = "staff.listReturn";
/** How long after Back or Forward the stored copy still counts (a slow page fetch). */
const POPSTATE_WINDOW_MS = 15_000;

type StoredReturn = ListReturn & { url: string };

const here = () => `${window.location.pathname}${window.location.search}`;

/** The last Back or Forward: when, and to which address. */
let lastPop: { at: number; url: string } | null = null;
let listening = false;
function listenForPopstate(): void {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("popstate", () => {
    lastPop = { at: Date.now(), url: here() };
  });
}
listenForPopstate();

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readStored(): StoredReturn | null {
  try {
    const value = JSON.parse(storage()?.getItem(LIST_RETURN_STORAGE_KEY) ?? "null") as unknown;
    if (!isListReturn(value) || typeof (value as StoredReturn).url !== "string") return null;
    return value as StoredReturn;
  } catch {
    return null;
  }
}

function clearStored(): void {
  try {
    storage()?.removeItem(LIST_RETURN_STORAGE_KEY);
  } catch {
    // Nothing kept.
  }
}

function currentState(): Record<string, unknown> {
  const state = window.history.state as HistoryState;
  return state && typeof state === "object" ? state : {};
}

function isListReturn(value: unknown): value is ListReturn {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.rowId === "string" && typeof entry.scrollY === "number";
}

/** Called as a row opens its record: marks this list's history entry with its scroll and row. */
export function rememberListReturn(rowId: string): void {
  const entry: ListReturn = { rowId, scrollY: Math.round(window.scrollY) };
  try {
    window.history.replaceState({ ...currentState(), [LIST_RETURN_STATE_KEY]: entry }, "");
  } catch {
    // History unavailable (a sandboxed frame): Back still works, only the row is not marked.
  }
  try {
    storage()?.setItem(LIST_RETURN_STORAGE_KEY, JSON.stringify({ ...entry, url: here() }));
  } catch {
    // Storage unavailable: the history mark alone.
  }
}

/**
 * The row this history entry opened, once: the mark is removed as it is read, so it marks the
 * row only on the return. Null when the list was not reached by coming back to it.
 */
export function takeListReturn(): ListReturn | null {
  const state = currentState();
  const entry = state[LIST_RETURN_STATE_KEY];
  if (!isListReturn(entry)) return takeStoredReturn();
  clearStored();
  const { [LIST_RETURN_STATE_KEY]: _taken, ...rest } = state;
  try {
    window.history.replaceState(rest, "");
  } catch {
    // Left in place: a reload marks the row again, which is harmless.
  }
  return entry;
}

/** The stored copy, when this list was just reached by Back or Forward to the same address. */
function takeStoredReturn(): ListReturn | null {
  const stored = readStored();
  if (!stored) return null;
  const url = here();
  const justCameBack =
    lastPop !== null && lastPop.url === url && Date.now() - lastPop.at < POPSTATE_WINDOW_MS;
  if (stored.url !== url || !justCameBack) return null;
  clearStored();
  lastPop = null;
  return { rowId: stored.rowId, scrollY: stored.scrollY };
}
