/** Whitespace, hyphens and the look-alike dashes and spaces that authenticator apps and password managers insert. */
const CODE_SEPARATORS = /[\s ‐-―−-]+/g;

const BACKUP_CODE_LENGTH = 10;
const BACKUP_CODE_GROUP = 5;

/** Authenticator apps display "123 456" and many users paste it as shown. */
export function normaliseTotpCode(raw: string): string {
  return raw.replace(CODE_SEPARATORS, "");
}

/**
 * Backup codes are case-sensitive and stored as `xxxxx-xxxxx`, so the case is kept and the
 * hyphen is put back after the separators are stripped. Anything that is not exactly ten
 * characters is returned stripped but unformatted and left for the server to reject.
 */
export function normaliseBackupCode(raw: string): string {
  const stripped = raw.replace(CODE_SEPARATORS, "");
  if (stripped.length !== BACKUP_CODE_LENGTH) return stripped;
  return `${stripped.slice(0, BACKUP_CODE_GROUP)}-${stripped.slice(BACKUP_CODE_GROUP)}`;
}
