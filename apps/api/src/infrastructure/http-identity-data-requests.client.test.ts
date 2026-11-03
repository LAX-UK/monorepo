import { describe, expect, it, vi } from "vitest";
import { DataRequestsUnavailableError } from "../services/interfaces/identity-data-requests-client.js";
import { HttpIdentityDataRequestsClient } from "./http-identity-data-requests.client.js";

const SUMMARY = {
  open: 2,
  dueSoon: 1,
  overdue: 0,
  waitingForId: 0,
  answeredLast12Months: { answered: 4, onTime: 4 },
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function setup(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
  withCredentials = true,
) {
  const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/internal/oauth/token")) {
      return reply(200, {
        access_token: "tok",
        token_type: "Bearer",
        expires_in: 300,
        scope: "data_requests.staff",
      });
    }
    return handler(url, init ?? {});
  });
  const client = new HttpIdentityDataRequestsClient({
    issuerBaseUrl: "https://auth.internal/",
    ...(withCredentials ? { clientId: "bid-data-requests", clientSecret: "s".repeat(32) } : {}),
    fetchImpl: fetchImpl as never,
  });
  return { client, fetchImpl };
}

describe("HttpIdentityDataRequestsClient", () => {
  it("asks for a token of its own scope with its own client", async () => {
    const { client, fetchImpl } = setup(() => reply(200, SUMMARY));
    await client.summary();
    const [, tokenInit] = fetchImpl.mock.calls[0] ?? [];
    expect(String((tokenInit?.body as URLSearchParams).get("scope"))).toBe("data_requests.staff");
    expect((tokenInit?.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from(`bid-data-requests:${"s".repeat(32)}`).toString("base64")}`,
    );
  });

  it("reuses the token between calls", async () => {
    const { client, fetchImpl } = setup(() => reply(200, SUMMARY));
    await client.summary();
    await client.summary();
    expect(
      fetchImpl.mock.calls.filter(([url]) => String(url).endsWith("/oauth/token")),
    ).toHaveLength(1);
  });

  it("calls the internal list route with the filters", async () => {
    const { client, fetchImpl } = setup(() => reply(200, { items: [], nextCursor: null }));
    await client.list({ view: "overdue", sort: "due", q: "lena@north.com" });
    const [url, init] = fetchImpl.mock.calls[1] ?? [];
    expect(String(url)).toBe(
      "https://auth.internal/internal/identity/data-requests?view=overdue&sort=due&q=lena%40north.com",
    );
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer tok");
  });

  it("sends the staff member with an action", async () => {
    const { client, fetchImpl } = setup(() => reply(200, { request: {} }));
    await client.continueDownload("DL-7F3C1A", "staff-1").catch(() => undefined);
    const [url, init] = fetchImpl.mock.calls[1] ?? [];
    expect(String(url)).toBe(
      "https://auth.internal/internal/identity/data-requests/DL-7F3C1A/continue",
    );
    expect(JSON.parse(String(init?.body))).toEqual({ actorSubjectId: "staff-1" });
  });

  it("returns a business refusal with its status and code", async () => {
    const { client } = setup(() => reply(409, { error: "stale_version" }));
    expect(
      await client.close("DR-0001", { actorSubjectId: "s", version: 1, outcome: "sent" }),
    ).toEqual({
      ok: false,
      status: 409,
      error: "stale_version",
    });
  });

  it("treats a server error, a bad body and a network failure as an outage", async () => {
    await expect(setup(() => reply(500, {})).client.summary()).rejects.toBeInstanceOf(
      DataRequestsUnavailableError,
    );
    await expect(
      setup(() => reply(200, { nonsense: true })).client.summary(),
    ).rejects.toBeInstanceOf(DataRequestsUnavailableError);
    const failing = setup(() => {
      throw new Error("ECONNREFUSED");
    });
    await expect(failing.client.summary()).rejects.toBeInstanceOf(DataRequestsUnavailableError);
    await expect(setup(() => reply(500, {})).client.record("DR-0001", "s")).rejects.toBeInstanceOf(
      DataRequestsUnavailableError,
    );
  });

  it("is unavailable, not crashing, when no credential is configured", async () => {
    const { client, fetchImpl } = setup(() => reply(200, SUMMARY), false);
    await expect(client.summary()).rejects.toBeInstanceOf(DataRequestsUnavailableError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fetches a new token once after a 401", async () => {
    let first = true;
    const { client, fetchImpl } = setup(() => {
      if (first) {
        first = false;
        return reply(401, { error: "unauthorized" });
      }
      return reply(200, SUMMARY);
    });
    expect(await client.summary()).toMatchObject({ open: 2 });
    expect(
      fetchImpl.mock.calls.filter(([url]) => String(url).endsWith("/oauth/token")),
    ).toHaveLength(2);
  });
});
