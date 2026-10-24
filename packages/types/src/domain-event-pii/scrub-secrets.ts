/**
 * Removes credentials from a domain event payload before it is shown to staff.
 *
 * Applied on top of PII minimisation and also when a caller may read PII: holding
 * `audit.read_pii` lets someone see a name or an email, never a token or a password.
 */

export const SECRET_PLACEHOLDER = "[REDACTED]";

const SECRET_KEY =
  /token|secret|password|passcode|passphrase|otp|authorization|api[_-]?key|cookie|credential(?!_changed)|private[_-]?key|signature|jwt|bearer|backup[_-]?codes?|recovery[_-]?codes?|totp|session[_-]?id/i;

/** Values that are credentials whatever key they sit under. */
const SECRET_VALUE =
  /^(?:Bearer\s+\S+|eyJ[\w-]+\.[\w-]+\.[\w-]+|(?:sk|rk|pk)_(?:live|test)_\w+|whsec_\w+|xox[abp]-[\w-]+|gh[pousr]_\w{20,})$/;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

export function isSecretValue(value: string): boolean {
  return SECRET_VALUE.test(value.trim());
}

export function scrubPayloadSecrets(value: unknown): unknown {
  if (typeof value === "string") return isSecretValue(value) ? SECRET_PLACEHOLDER : value;
  if (Array.isArray(value)) return value.map(scrubPayloadSecrets);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSecretKey(key) ? SECRET_PLACEHOLDER : scrubPayloadSecrets(entry);
    }
    return out;
  }
  return value;
}
