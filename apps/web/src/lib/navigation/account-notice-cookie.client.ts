import {
  ACCOUNT_NOTICE_COOKIE,
  ACCOUNT_NOTICE_MAX_AGE_SEC,
  type AccountNotice,
  decodeAccountNotice,
  encodeAccountNotice,
} from "./account-notice";

/** The notice waiting for this page, if any. */
export function readAccountNotice(): AccountNotice | null {
  const prefix = `${ACCOUNT_NOTICE_COOKIE}=`;
  const raw = document.cookie
    .split("; ")
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  return decodeAccountNotice(raw);
}

/**
 * Leaves a one-time notice for the next page load, from the browser. The layout reads it once and
 * the notice clears its own cookie when shown; the short life is the backstop if the page never
 * loads.
 */
export function leaveAccountNotice(notice: AccountNotice): void {
  document.cookie = `${ACCOUNT_NOTICE_COOKIE}=${encodeAccountNotice(notice)}; path=/; max-age=${ACCOUNT_NOTICE_MAX_AGE_SEC}; SameSite=Lax`;
}

/** Clears the notice once it has been shown, so it never repeats. */
export function clearAccountNotice(): void {
  document.cookie = `${ACCOUNT_NOTICE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
