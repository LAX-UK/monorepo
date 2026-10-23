/**
 * What a change made from LAX Account tells the page. `reauth_required` covers both "your
 * sign-in is too old for this" and "you are no longer signed in": the page sends the person
 * through a fresh sign-in and back.
 */
export type AccountActionResult =
  | { status: "ok"; message: string }
  | { status: "reauth_required" }
  | { status: "error"; message: string };

/** The result of creating backup codes: the codes themselves, instead of a message. */
export type BackupCodesActionResult =
  | { status: "ok"; backupCodes: string[] }
  | { status: "reauth_required" }
  | { status: "error"; message: string };
