export type PayeeConnectReadinessInput = {
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: readonly string[];
  disabledReason: string | null;
};

/**
 * Whether a payee's connected account can receive transfers. Recipient accounts only request
 * the `transfers` capability, so `charges_enabled` is deliberately not part of readiness.
 */
export function isPayeeConnectReady(input: PayeeConnectReadinessInput): boolean {
  return (
    input.payoutsEnabled &&
    input.requirementsCurrentlyDue.length === 0 &&
    !input.disabledReason?.trim()
  );
}
