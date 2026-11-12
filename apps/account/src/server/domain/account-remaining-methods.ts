/** What a person would still sign in with once one way in is removed. */
export type RemainingMethods = {
  hasPassword: boolean;
  /** Passkeys left after the removal. */
  passkeys: number;
  /** Labels of the linked providers left after the removal, such as "Google". */
  providers: readonly string[];
};

/**
 * The ways left to sign in, in plain words for a confirmation: "your password, your other passkey
 * or Google". `otherPasskeys` says the removal is itself a passkey, so the ones left are "other".
 * Null when nothing is left, which the last-method rule never allows to be confirmed.
 */
export function describeRemainingMethods(
  left: RemainingMethods,
  options: { otherPasskeys?: boolean } = {},
): string | null {
  const other = options.otherPasskeys ? "other " : "";
  const parts = [
    ...(left.hasPassword ? ["your password"] : []),
    ...(left.passkeys > 0 ? [`your ${other}passkey${left.passkeys === 1 ? "" : "s"}`] : []),
    ...left.providers,
  ];
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0] ?? null;
  return `${parts.slice(0, -1).join(", ")} or ${parts[parts.length - 1]}`;
}
