import { SSF_EVENT_TYPES, isAllowedSsfEndpoint } from "@auction/identity-contracts";
import { describe, expect, it } from "vitest";
import type { SsfService } from "../services/ssf.service.js";
import { createSsfRoutes } from "./ssf.routes.js";

const clients = {
  authenticate: async (clientId: string, clientSecret: string) =>
    clientId === "lax-bid-web" && clientSecret === "secret" ? ("lax-bid-web" as const) : null,
};

function request(endpoint: string, authenticated = true): Request {
  return new Request("https://auth.lax.bid/stream", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authenticated
        ? { authorization: `Basic ${Buffer.from("lax-bid-web:secret").toString("base64")}` }
        : {}),
    },
    body: JSON.stringify({
      delivery: { method: "urn:ietf:rfc:8935", endpoint_url: endpoint },
      events_requested: [SSF_EVENT_TYPES.ACCOUNT_DISABLED],
    }),
  });
}

describe("SSF stream management route", () => {
  it("requires registered confidential-client authentication", async () => {
    const app = createSsfRoutes({
      clients,
      service: {} as SsfService,
    });
    expect((await app.request(request("https://api.lax.bid/ssf/events", false))).status).toBe(401);
  });

  it("rejects receiver endpoints outside the exact first-party allowlist", async () => {
    const service = {
      create: async (clientId: "lax-bid-web", input: { endpoint: string }) => {
        if (!isAllowedSsfEndpoint(clientId, input.endpoint, "production")) {
          throw new Error("invalid_endpoint");
        }
        throw new Error("unexpected");
      },
    } as unknown as SsfService;
    const app = createSsfRoutes({ clients, service });
    const response = await app.request(request("https://169.254.169.254/latest/meta-data"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid_endpoint" });
  });
});
