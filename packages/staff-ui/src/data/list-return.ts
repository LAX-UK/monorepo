/*
 * Back puts you where you were: when a row opens its record page, the list marks its own
 * history entry with the scroll position and the row. Coming back to that entry (Back, the
 * phone's back gesture, or a reload of it) restores the scroll and marks the row. A fresh visit
 * to the list (the nav, a link) is a new entry without the mark, so it starts fresh, as people
 * expect.
 *
 * The mark lives in `history.state`, beside a router's own state (Next.js keeps keys it does not
 * own), so it needs no timing: routers re-render a list on Back before `popstate` fires.
 */

/** The key in `history.state` that holds the row a list opened. */
export const LIST_RETURN_STATE_KEY = "__staffListReturn";

export type ListReturn = {
  rowId: string;
  scrollY: number;
};

type HistoryState = Record<string, unknown> | null;

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
}

/**
 * The row this history entry opened, once: the mark is removed as it is read, so it marks the
 * row only on the return. Null when the list was not reached by coming back to it.
 */
export function takeListReturn(): ListReturn | null {
  const state = currentState();
  const entry = state[LIST_RETURN_STATE_KEY];
  if (!isListReturn(entry)) return null;
  const { [LIST_RETURN_STATE_KEY]: _taken, ...rest } = state;
  try {
    window.history.replaceState(rest, "");
  } catch {
    // Left in place: a reload marks the row again, which is harmless.
  }
  return entry;
}
