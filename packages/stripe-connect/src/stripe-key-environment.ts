/**
 * Stripe keys a test environment may hold. A deployed test stack must never be able to move real
 * money, so when `APP_ENV=test` every Stripe key that is set has to be a test-mode key. The API,
 * the Shop API and the worker all check their keys with this one rule.
 */

export type StripeKeyKind = "secret" | "publishable" | "restricted";

const TEST_MODE_PREFIXES: Record<StripeKeyKind, readonly string[]> = {
  secret: ["sk_test_", "rk_test_"],
  publishable: ["pk_test_"],
  restricted: ["rk_test_"],
};

export type StripeKeyToCheck = {
  /** The environment variable the key came from, used in the message and as the issue path. */
  name: string;
  kind: StripeKeyKind;
  /** The key, or several comma-separated keys. Unset keys are not checked. */
  value: string | undefined;
};

export type StripeKeyIssue = { name: string; message: string };

/** Whether one key (not a list) is a Stripe test-mode key of the given kind. */
export function isStripeTestModeKey(kind: StripeKeyKind, key: string): boolean {
  return TEST_MODE_PREFIXES[kind].some((prefix) => key.trim().startsWith(prefix));
}

/**
 * The keys that break the test-mode rule. Empty unless `appEnv` is `test`; other environments
 * have their own checks.
 */
export function stripeTestModeKeyIssues(
  appEnv: string | undefined,
  keys: readonly StripeKeyToCheck[],
): StripeKeyIssue[] {
  if (appEnv?.trim() !== "test") return [];
  const issues: StripeKeyIssue[] = [];
  for (const { name, kind, value } of keys) {
    const parts = (value ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.every((part) => isStripeTestModeKey(kind, part))) continue;
    const allowed = TEST_MODE_PREFIXES[kind].map((prefix) => `${prefix}…`).join(" or ");
    issues.push({ name, message: `${name} in test must use a test key (${allowed})` });
  }
  return issues;
}
