import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createInventoryPeerClient } from "./inventory-peer-client.js";
import { InventoryPeerRefusedError, InventoryPeerUnavailableError } from "./move-originals.js";

const answer = z.object({ ok: z.literal(true) });

function client(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const peer = createInventoryPeerClient({
    baseUrl: "https://bid.example/",
    clientId: "id-1",
    clientSecret: "secret-1",
    fetchImpl: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond(url, init);
    }) as unknown as typeof fetch,
  });
  return { peer, calls };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("inventory peer client", () => {
  it("sends the machine credential and the body, and parses the answer", async () => {
    const { peer, calls } = client(() => json(200, { ok: true }));
    await expect(peer.call("POST", "/draft-lots", answer, { a: 1 })).resolves.toEqual({ ok: true });
    expect(calls[0]?.url).toBe("https://bid.example/internal/inventory/draft-lots");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["x-inventory-client-id"]).toBe("id-1");
    expect(headers["x-inventory-client-secret"]).toBe("secret-1");
    expect(calls[0]?.init.body).toBe('{"a":1}');
  });

  it("turns a refusal with a reason into an error carrying the message", async () => {
    const { peer } = client(() =>
      json(409, { error: "sale_not_open", message: "That sale has started." }),
    );
    const error = await peer.call("GET", "/auction-sales", answer).catch((e) => e);
    expect(error).toBeInstanceOf(InventoryPeerRefusedError);
    expect(error.message).toBe("That sale has started.");
    expect(error.refusal.error).toBe("sale_not_open");
  });

  it("keeps a closed boundary (not configured) as a refusal, not an outage", async () => {
    const { peer } = client(() =>
      json(503, { error: "not_configured", message: "The house seller account is not set." }),
    );
    const error = await peer.call("GET", "/auction-sales", answer).catch((e) => e);
    expect(error).toBeInstanceOf(InventoryPeerRefusedError);
  });

  it("treats a network failure, a server fault and an odd answer as unavailable", async () => {
    const down = client(() => {
      throw new TypeError("fetch failed");
    });
    await expect(down.peer.call("GET", "/auction-sales", answer)).rejects.toBeInstanceOf(
      InventoryPeerUnavailableError,
    );
    const fault = client(() => json(500, { oops: true }));
    await expect(fault.peer.call("GET", "/auction-sales", answer)).rejects.toBeInstanceOf(
      InventoryPeerUnavailableError,
    );
    const odd = client(() => json(200, { nope: 1 }));
    await expect(odd.peer.call("GET", "/auction-sales", answer)).rejects.toBeInstanceOf(
      InventoryPeerUnavailableError,
    );
  });
});
