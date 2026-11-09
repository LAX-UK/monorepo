import type { JwksProvider } from "../infrastructure/jwks-provider.js";

/** The slice of the signing-key gauge this reconciliation needs. */
export type SigningKeyAgeGauge = {
  reset(): void;
  set(labels: { kid: string }, value: number): void;
};

/**
 * Publishes the age of the active signing key. The gauge is reset first so a rotated-out
 * key id stops being reported. Only the key id is used as a label, never key material.
 */
export async function reconcileSigningKeyAgeMetric(
  jwks: Pick<JwksProvider, "getActiveSigningJwk">,
  gauge: SigningKeyAgeGauge,
  now: () => Date = () => new Date(),
): Promise<void> {
  const active = await jwks.getActiveSigningJwk();
  gauge.reset();
  if (!active?.createdAt) return;
  const ageSeconds = Math.max(0, (now().getTime() - active.createdAt.getTime()) / 1_000);
  gauge.set({ kid: active.id }, ageSeconds);
}
