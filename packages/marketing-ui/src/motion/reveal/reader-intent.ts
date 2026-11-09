/**
 * Whether anyone is reading the page by moving through it. A capture, a print, a link preview or
 * a reader that never scrolls sees the page exactly as the server sent it; only a person who
 * starts to scroll, or presses a navigation key (paging, space, the arrows, Home, End or Tab), is
 * shown the reveal animations. Until then nothing below the first screens is held back, and
 * typing into a field does not count.
 */
const MOVE_EVENTS = ["scroll", "wheel", "touchmove"] as const;

const NAVIGATION_KEYS = new Set([
  "PageUp",
  "PageDown",
  " ",
  "Spacebar",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "Tab",
]);

function onKey(event: KeyboardEvent) {
  if (NAVIGATION_KEYS.has(event.key)) onMove();
}

const waiting = new Set<() => void>();
let moved = false;
let listening = false;

function onMove() {
  moved = true;
  stopListening();
  const callbacks = [...waiting];
  waiting.clear();
  for (const callback of callbacks) callback();
}

function startListening() {
  if (listening) return;
  listening = true;
  for (const type of MOVE_EVENTS) window.addEventListener(type, onMove, { passive: true });
  window.addEventListener("keydown", onKey);
}

function stopListening() {
  if (!listening) return;
  listening = false;
  for (const type of MOVE_EVENTS) window.removeEventListener(type, onMove);
  window.removeEventListener("keydown", onKey);
}

/**
 * Calls `callback` once, when the reader first moves through the page: at once if they already
 * have (or the page opened part-way down). Returns a function that cancels the wait.
 */
export function whenReaderMoves(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (moved || window.scrollY > 0) {
    callback();
    return () => {};
  }
  waiting.add(callback);
  startListening();
  return () => {
    waiting.delete(callback);
    if (waiting.size === 0) stopListening();
  };
}

/** Forgets that the reader moved. For tests only. */
export function resetReaderIntentForTests(): void {
  moved = false;
  waiting.clear();
  stopListening();
}
