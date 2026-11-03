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

/**
 * The result of changing the password. An error says which field it belongs to, so the form can
 * mark that field and list it in the error summary; `field` is null for a failure that is about
 * no field in particular (the issuer could not be reached).
 */
export type PasswordActionResult =
  | { status: "ok"; created: boolean }
  | { status: "reauth_required" }
  | { status: "error"; message: string; field: "current" | "next" | "confirm" | null };
