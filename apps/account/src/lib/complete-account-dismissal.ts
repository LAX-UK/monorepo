type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY = "lax-account:complete-account-dismissed";

/**
 * The stored value is the list of gaps the person dismissed, so the prompt comes
 * back when a different detail goes missing. Storage can be absent or throw
 * (private mode, blocked site data); the prompt then simply shows again.
 */
export function isCompleteAccountPromptDismissed(
  storage: KeyValueStorage | null,
  gapsKey: string,
): boolean {
  try {
    return storage?.getItem(STORAGE_KEY) === gapsKey;
  } catch {
    return false;
  }
}

export function dismissCompleteAccountPrompt(storage: KeyValueStorage | null, gapsKey: string) {
  try {
    storage?.setItem(STORAGE_KEY, gapsKey);
  } catch {
    // Dismissal is a per-device convenience; losing it only re-shows the prompt.
  }
}

export function browserLocalStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
