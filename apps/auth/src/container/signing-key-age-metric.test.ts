import { describe, expect, it } from "vitest";
import { createAuthMetrics } from "./create-auth-metrics.js";
import { reconcileSigningKeyAgeMetric } from "./signing-key-age-metric.js";

const NOW = new Date("2026-06-10T00:00:00.000Z");
const key = (id: string, createdAt?: Date) => ({
  id,
  publicKey: "public",
  privateKey: "private-material",
  ...(createdAt ? { createdAt } : {}),
});

describe("reconcileSigningKeyAgeMetric", () => {
  it("reports the age of the active key in seconds, labelled by key id only", async () => {
    const metrics = createAuthMetrics();
    const created = new Date(NOW.getTime() - 90 * 86_400_000);
    await reconcileSigningKeyAgeMetric(
      { getActiveSigningJwk: async () => key("kid-1", created) },
      metrics.signingKeyAgeSeconds,
      () => NOW,
    );

    const exposition = await metrics.registry.metrics();
    expect(exposition).toContain(`auction_auth_signing_key_age_seconds{kid="kid-1"} 7776000`);
    expect(exposition).not.toContain("private-material");
  });

  it("drops the previous key id after rotation", async () => {
    const metrics = createAuthMetrics();
    const read = (active: ReturnType<typeof key>) =>
      reconcileSigningKeyAgeMetric(
        { getActiveSigningJwk: async () => active },
        metrics.signingKeyAgeSeconds,
        () => NOW,
      );
    await read(key("old", new Date(NOW.getTime() - 1_000_000)));
    await read(key("new", new Date(NOW.getTime() - 5_000)));

    const exposition = await metrics.registry.metrics();
    expect(exposition).not.toContain('kid="old"');
    expect(exposition).toContain('auction_auth_signing_key_age_seconds{kid="new"} 5');
  });

  it("reports no series when there is no active key", async () => {
    const metrics = createAuthMetrics();
    await reconcileSigningKeyAgeMetric(
      { getActiveSigningJwk: async () => null },
      metrics.signingKeyAgeSeconds,
      () => NOW,
    );
    expect(await metrics.registry.metrics()).not.toContain("signing_key_age_seconds{");
  });

  it("clamps a creation time in the future to zero", async () => {
    const metrics = createAuthMetrics();
    await reconcileSigningKeyAgeMetric(
      { getActiveSigningJwk: async () => key("kid-1", new Date(NOW.getTime() + 60_000)) },
      metrics.signingKeyAgeSeconds,
      () => NOW,
    );
    expect(await metrics.registry.metrics()).toContain('{kid="kid-1"} 0');
  });
});
