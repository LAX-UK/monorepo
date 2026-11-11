/**
 * What a change made from LAX Account tells the page. `reauth_required` covers both "your
 * sign-in is too old for this" and "you are no longer signed in": the page sends the person
 * through a fresh sign-in and back.
 */
export type AccountActionResult =
  | { status: "ok"; message: string }
  | { status: "reauth_required" }
  /**
   * `stale` says the page was out of date (that method was already gone, or is now the last way
   * in), so the person is shown the list as it is, with the message.
   */
  | { status: "error"; message: string; stale?: true };

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

/**
 * The result of asking to link Google or Apple: the address the browser goes to next (the issuer's
 * own page), or why it does not. `refresh` says the page was out of date (that method is already
 * linked), so the person is shown the list as it is.
 */
export type LinkActionResult =
  | { status: "ok"; url: string }
  | { status: "reauth_required" }
  | { status: "error"; message: string; refresh: boolean };
