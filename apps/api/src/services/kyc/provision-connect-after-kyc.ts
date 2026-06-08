/** Minimal Connect provisioning port (kept narrow for testability / DIP). */
export interface IConnectAccountProvisioner {
  isConfigured(): boolean;
  ensureAccount(legalEntityId: string): Promise<unknown>;
}

/**
 * Best-effort Stripe Connect account creation for individuals just advanced to
 * `connect_pending` by KYC approval. Runs outside the progression DB transaction and
 * never throws: the client onboarding flow retries via {@link ensureStripeConnectAccountAction}
 * if a creation here fails or Connect is not configured.
 */
export async function provisionConnectForIndividuals(
  connect: IConnectAccountProvisioner,
  legalEntityIds: string[],
): Promise<void> {
  if (legalEntityIds.length === 0) return;
  if (!connect.isConfigured()) return;

  for (const legalEntityId of legalEntityIds) {
    try {
      await connect.ensureAccount(legalEntityId);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "connect_provision_after_kyc_failed",
          legalEntityId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
