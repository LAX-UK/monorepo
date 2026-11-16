/**
 * Stripe keys an environment may hold. A test stack must never be able to move real money, and a
 * deployed test host whose `APP_ENV` is unset or mis-set must not get past this either, so the
 * rule fails closed: live keys are allowed only when `APP_ENV` is exactly `production`. Every other
 * value, and no value, needs test-mode keys. The API, the Shop API and the worker all check their
 * keys with this one rule.
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

/** Whether this `APP_ENV` value may hold live Stripe keys: only exactly `production`. */
export function allowsLiveStripeKeys(appEnv: string | undefined): boolean {
  return appEnv === "production";
}

/**
 * The keys that break the test-mode rule: any live key, unless `appEnv` is exactly `production`.
 * Pass the `APP_ENV` value as it was set, not one derived from `NODE_ENV`, so an unset value is
 * treated as "not production".
 */
export function stripeTestModeKeyIssues(
  appEnv: string | undefined,
  keys: readonly StripeKeyToCheck[],
): StripeKeyIssue[] {
  if (allowsLiveStripeKeys(appEnv)) return [];
  const issues: StripeKeyIssue[] = [];
  for (const { name, kind, value } of keys) {
    const parts = (value ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.every((part) => isStripeTestModeKey(kind, part))) continue;
    const allowed = TEST_MODE_PREFIXES[kind].map((prefix) => `${prefix}…`).join(" or ");
    issues.push({
      name,
      message: `${name} must use a test key (${allowed}) unless APP_ENV=production`,
    });
  }
  return issues;
}
