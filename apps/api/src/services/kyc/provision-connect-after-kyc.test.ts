import { describe, expect, it, vi } from "vitest";
import { provisionConnectForIndividuals } from "./provision-connect-after-kyc.js";

describe("provisionConnectForIndividuals", () => {
  it("ensures an account for each advanced entity when Connect is configured", async () => {
    const ensureAccount = vi.fn().mockResolvedValue(undefined);
    const connect = { isConfigured: () => true, ensureAccount };

    await provisionConnectForIndividuals(connect, ["le1", "le2"]);

    expect(ensureAccount).toHaveBeenCalledTimes(2);
    expect(ensureAccount).toHaveBeenCalledWith("le1");
    expect(ensureAccount).toHaveBeenCalledWith("le2");
  });

  it("no-ops when there are no advanced entities", async () => {
    const ensureAccount = vi.fn();
    const connect = { isConfigured: () => true, ensureAccount };

    await provisionConnectForIndividuals(connect, []);

    expect(ensureAccount).not.toHaveBeenCalled();
  });

  it("skips provisioning when Connect is not configured", async () => {
    const ensureAccount = vi.fn();
    const connect = { isConfigured: () => false, ensureAccount };

    await provisionConnectForIndividuals(connect, ["le1"]);

    expect(ensureAccount).not.toHaveBeenCalled();
  });

  it("continues past a failing entity and never throws (client fallback retries)", async () => {
    const ensureAccount = vi
      .fn()
      .mockRejectedValueOnce(new Error("stripe boom"))
      .mockResolvedValueOnce(undefined);
    const connect = { isConfigured: () => true, ensureAccount };

    await expect(provisionConnectForIndividuals(connect, ["le1", "le2"])).resolves.toBeUndefined();
    expect(ensureAccount).toHaveBeenCalledTimes(2);
  });
});
