import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerKycRoutesSlice } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createKycRoutes } from "./kyc.js";

function buildApp(kycHttp: ContainerKycRoutesSlice["compliance"]["kycHttp"]) {
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    compliance: { kycHttp },
  } as unknown as ContainerKycRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "user-1", role: "client" }),
  };
  const app = new Hono();
  app.route("/kyc", createKycRoutes(container, authenticator));
  return app;
}

describe("kyc routes", () => {
  it("GET /kyc/status returns summary", async () => {
    const kycHttp = {
      getStatus: vi.fn().mockResolvedValue({
        status: 200,
        body: { data: { status: "none", requiresKyc: false } },
      }),
      getLatestSession: vi.fn(),
      createSession: vi.fn(),
    };
    const app = buildApp(kycHttp as never);
    const res = await app.request("http://test/kyc/status");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { status: "none", requiresKyc: false } });
  });

  it("POST /kyc/session maps not configured to 503", async () => {
    const kycHttp = {
      getStatus: vi.fn(),
      getLatestSession: vi.fn(),
      createSession: vi.fn().mockResolvedValue({
        status: 503,
        body: { error: "kyc_not_configured" },
      }),
    };
    const app = buildApp(kycHttp as never);
    const res = await app.request("http://test/kyc/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ returnUrl: "https://example.com/callback" }),
    });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "kyc_not_configured" });
  });
});
