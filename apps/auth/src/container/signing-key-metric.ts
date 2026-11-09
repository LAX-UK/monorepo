import type { SigningKeyInfoReader } from "../infrastructure/jwks-provider.js";

/** The slice of the signing-key gauge this reconciliation needs. */
export type SigningKeyCreatedGauge = {
  reset(): void;
  set(labels: { kid: string }, value: number): void;
};

/**
 * Publishes when the active signing key was created. The gauge is reset first so a rotated-out
 * key id stops being reported. Only the key id and creation time are read, never key material;
 * the age is computed in PromQL as `time() - auction_auth_signing_key_created_timestamp_seconds`.
 */
export async function reconcileSigningKeyMetric(
  keys: SigningKeyInfoReader,
  gauge: SigningKeyCreatedGauge,
): Promise<void> {
  const active = await keys.getActiveSigningKeyInfo();
  gauge.reset();
  if (!active) return;
  gauge.set({ kid: active.kid }, Math.floor(active.createdAt.getTime() / 1_000));
}
