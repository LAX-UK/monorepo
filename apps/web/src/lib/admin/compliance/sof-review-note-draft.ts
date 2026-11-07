/**
 * A reviewer's notes survive the sign-in round trip: when saving a document review asks for a
 * fresh sign-in, the browser leaves for hosted re-authentication and the page reloads. The notes
 * are parked in sessionStorage under the document id and put back on return; a successful save
 * clears them. sessionStorage is per tab and gone when the tab closes.
 */
const PREFIX = "sof-review-note:";

const keyFor = (documentId: string) => `${PREFIX}${documentId}`;

export function stashSofReviewNote(documentId: string, note: string): void {
  try {
    if (note === "") {
      window.sessionStorage.removeItem(keyFor(documentId));
      return;
    }
    window.sessionStorage.setItem(keyFor(documentId), note);
  } catch {
    // Storage can be blocked; the reviewer simply retypes the note.
  }
}

export function readSofReviewNote(documentId: string): string | null {
  try {
    return window.sessionStorage.getItem(keyFor(documentId));
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
