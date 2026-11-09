import { describe, expect, it, vi } from "vitest";
import { createAuthMetrics } from "./create-auth-metrics.js";
import { reconcileSigningKeyMetric } from "./signing-key-metric.js";

const NAME = "auction_auth_signing_key_created_timestamp_seconds";
const created = new Date("2026-06-10T00:00:00.000Z");
const createdSeconds = created.getTime() / 1_000;

describe("reconcileSigningKeyMetric", () => {
  it("reports the creation time of the active key, labelled by key id only", async () => {
    const metrics = createAuthMetrics();
    const reader = { getActiveSigningKeyInfo: async () => ({ kid: "kid-1", createdAt: created }) };
    await reconcileSigningKeyMetric(reader, metrics.signingKeyCreatedTimestampSeconds);

    expect(await metrics.registry.metrics()).toContain(`${NAME}{kid="kid-1"} ${createdSeconds}`);
  });

  it("reads only the key id and creation time", async () => {
    const metrics = createAuthMetrics();
    const getActiveSigningKeyInfo = vi.fn(async () => ({ kid: "kid-1", createdAt: created }));
    await reconcileSigningKeyMetric(
      { getActiveSigningKeyInfo },
      metrics.signingKeyCreatedTimestampSeconds,
    );
    expect(getActiveSigningKeyInfo).toHaveBeenCalledTimes(1);
  });

  it("drops the previous key id after rotation", async () => {
    const metrics = createAuthMetrics();
    const read = (kid: string, createdAt: Date) =>
      reconcileSigningKeyMetric(
        { getActiveSigningKeyInfo: async () => ({ kid, createdAt }) },
        metrics.signingKeyCreatedTimestampSeconds,
      );
    await read("old", new Date(created.getTime() - 1_000_000));
    await read("new", created);

    const exposition = await metrics.registry.metrics();
    expect(exposition).not.toContain('kid="old"');
    expect(exposition).toContain(`${NAME}{kid="new"} ${createdSeconds}`);
  });

  it("reports no series when there is no active key", async () => {
    const metrics = createAuthMetrics();
    await reconcileSigningKeyMetric(
      { getActiveSigningKeyInfo: async () => null },
      metrics.signingKeyCreatedTimestampSeconds,
    );
    expect(await metrics.registry.metrics()).not.toContain(`${NAME}{`);
  });
});
