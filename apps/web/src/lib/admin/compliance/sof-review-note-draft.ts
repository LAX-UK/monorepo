/**
 * A reviewer's notes survive the sign-in round trip: when saving a document review asks for a
 * fresh sign-in, the browser leaves for hosted re-authentication and the page reloads. The notes
 * are parked in sessionStorage under the document id and put back on return; a successful save
 * clears them. sessionStorage is per tab and gone when the tab closes.
 */
const PREFIX = "sof-review-note:";

const keyFor = (documentId: string) => `${PREFIX}${documentId}`;

/** A parked note only bridges one sign-in round trip; an older one never hides a note saved since. */
const DRAFT_LIFETIME_MS = 30 * 60 * 1000;

type ParkedNote = { note: string; at: number };

export function stashSofReviewNote(documentId: string, note: string): void {
  try {
    if (note === "") {
      window.sessionStorage.removeItem(keyFor(documentId));
      return;
    }
    const parked: ParkedNote = { note, at: Date.now() };
    window.sessionStorage.setItem(keyFor(documentId), JSON.stringify(parked));
  } catch {
    // Storage can be blocked; the reviewer simply retypes the note.
  }
}

export function readSofReviewNote(documentId: string): string | null {
  try {
    const raw = window.sessionStorage.getItem(keyFor(documentId));
    if (raw === null) return null;
    const parked = JSON.parse(raw) as Partial<ParkedNote>;
    if (typeof parked.note !== "string" || typeof parked.at !== "number") return null;
    if (Date.now() - parked.at > DRAFT_LIFETIME_MS) {
      window.sessionStorage.removeItem(keyFor(documentId));
      return null;
    }
    return parked.note;
  } catch {
    return null;
  }
}

export function clearSofReviewNote(documentId: string): void {
  try {
    window.sessionStorage.removeItem(keyFor(documentId));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
