import { useSyncExternalStore } from "react";

/**
 * A person's first visit after a silent sign-in can trigger three overlays: the "You're signed
 * in" notice, the cookie banner and the account-switcher hint. They are shown one at a time, in
 * that order. The notice tells someone which account was signed in on their behalf (and lets
 * them sign out if it is not theirs), so it goes first; the cookie banner follows it and the
 * switcher hint waits for both.
 */
let signInNoticeActive = false;
const listeners = new Set<() => void>();

export function setSignInNoticeActive(active: boolean): void {
  if (signInNoticeActive === active) return;
  signInNoticeActive = active;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the sign-in notice is waiting to show or on screen. */
export function useSignInNoticeActive(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => signInNoticeActive,
    () => false,
  );
}
