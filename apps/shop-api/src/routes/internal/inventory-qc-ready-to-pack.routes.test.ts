import { describe, expect, it, vi } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const CLIENT_ID = "inventory-move";
const CLIENT_SECRET = "inventory-machine-secret-at-least-32-chars"; // gitleaks:allow
const URL = "/internal/inventory/zoho-qc-passed";
const machine = { "x-inventory-client-id": CLIENT_ID, "x-inventory-client-secret": CLIENT_SECRET };
const LINE = "7f1c3a52-9d1e-4b7a-8c55-2f0d6b1e9a10";
const BODY = { orderReference: "LAX-S-10482", lineId: LINE };

function app(configured = true) {
  const markPassed = vi.fn(async () => "moved" as const);
  const base = createMinimalShopApiTestDeps();
  const instance = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      inventory: {
        ...base.inventory,
        qcReady: { markPassed },
        machine: configured
          ? { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }
          : { clientId: undefined, clientSecret: undefined },
      },
    }),
    logger: false,
  });
  const ask = (payload: unknown, headers: Record<string, string> = machine) =>
    instance.inject({ method: "POST", url: URL, headers, payload: payload as object });
  return { ask, markPassed };
}

describe("internal inventory route: Zoho quality check passed", () => {
  it("is closed until the credential is configured, and refuses a wrong one, changing nothing", async () => {
    const closed = app(false);
    expect((await closed.ask(BODY)).statusCode).toBe(503);
    const open = app();
    const wrong = await open.ask(BODY, { ...machine, "x-inventory-client-secret": "x".repeat(40) });
    expect(wrong.statusCode).toBe(401);
    expect(closed.markPassed).not.toHaveBeenCalled();
    expect(open.markPassed).not.toHaveBeenCalled();
  });

  it("refuses a request that names no order line", async () => {
    const { ask, markPassed } = app();
    expect((await ask({ orderReference: "LAX-S-10482", lineId: "not-a-uuid" })).statusCode).toBe(
      400,
    );
    expect(markPassed).not.toHaveBeenCalled();
  });

  it("answers what happened, uncached", async () => {
    const { ask, markPassed } = app();
    const response = await ask(BODY);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: "moved" });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(markPassed).toHaveBeenCalledWith(BODY);
  });
});
