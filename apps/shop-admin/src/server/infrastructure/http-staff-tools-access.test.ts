import type { TokenEndpoint } from "@auction/identity-rp";
import { describe, expect, it, vi } from "vitest";
import { createHttpStaffToolsAccess } from "./http-staff-tools-access";

const SUBJECT = "5e7a9c21-0b34-4d68-a1f2-3c4d5e6f7a80";
const caller = { subjectId: SUBJECT, idToken: "id-token-for-test" };

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function setup(overrides: { baseUrl?: string | undefined } = {}) {
  const requestToken = vi
    .fn()
    .mockResolvedValue({ access_token: "exchanged-for-bid", expires_in: 300 });
  const tokenEndpoint = { requestToken } as unknown as TokenEndpoint;
  const options = {
    baseUrl: "http://api.internal:3001" as string | undefined,
    tokenEndpoint,
    timeoutMs: 50,
    ...overrides,
  };
  return { requestToken, options };
}

describe("createHttpStaffToolsAccess", () => {
  it("exchanges the session for a Bid token and asks as the signed-in person", async () => {
    const { requestToken, options } = setup();
    const fetch = vi.fn().mockResolvedValue(reply({ data: { tools: ["lax-admin", "bid-admin"] } }));

    const answer = await createHttpStaffToolsAccess({ ...options, fetch }).toolsFor(caller);

    expect(answer).toEqual({ status: "ok", tools: ["bid-admin", "lax-admin"] });
    const form = requestToken.mock.calls[0]?.[0] as URLSearchParams;
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:token-exchange");
    expect(form.get("subject_token")).toBe(caller.idToken);
    expect(form.get("subject_token_type")).toBe("urn:ietf:params:oauth:token-type:id_token");
    expect(form.get("resource")).toBe("https://api.lax.bid");
    expect(form.get("scope")).toBe("lax.staff.tools.read");
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://api.internal:3001/admin/staff/my-tools");
    expect(init.headers).toEqual({ authorization: "Bearer exchanged-for-bid" });
  });

  it("returns an empty list as a real answer, not a failure", async () => {
    const { options } = setup();
    const fetch = vi.fn().mockResolvedValue(reply({ data: { tools: [] } }));

    expect(await createHttpStaffToolsAccess({ ...options, fetch }).toolsFor(caller)).toEqual({
      status: "ok",
      tools: [],
    });
  });

  it("ignores tools it does not know", async () => {
    const { options } = setup();
    const fetch = vi
      .fn()
      .mockResolvedValue(reply({ data: { tools: ["vault-admin", "bid-admin"] } }));

    expect(await createHttpStaffToolsAccess({ ...options, fetch }).toolsFor(caller)).toEqual({
      status: "ok",
      tools: ["bid-admin"],
    });
  });

  it.each([
    ["refused token", () => reply({ error: "Forbidden" }, 403)],
    ["an expired session", () => reply({ error: "Unauthorized" }, 401)],
    ["Bid unavailable", () => reply({ error: "boom" }, 503)],
    ["a malformed body", () => reply({ data: { tools: "all" } })],
    ["a non-JSON body", () => new Response("<html>", { status: 200 })],
  ])("fails closed on %s", async (_name, respond) => {
    const { options } = setup();
    const fetch = vi.fn().mockImplementation(async () => respond());

    expect(await createHttpStaffToolsAccess({ ...options, fetch }).toolsFor(caller)).toEqual({
      status: "unavailable",
    });
  });

  it("fails closed, without calling Bid, when the token exchange is refused", async () => {
    const { requestToken, options } = setup();
    requestToken.mockRejectedValue(new Error("invalid_scope"));
    const fetch = vi.fn();

    expect(await createHttpStaffToolsAccess({ ...options, fetch }).toolsFor(caller)).toEqual({
      status: "unavailable",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed on a network error", async () => {
    const { options } = setup();
    const fetch = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED"));

    expect(await createHttpStaffToolsAccess({ ...options, fetch }).toolsFor(caller)).toEqual({
      status: "unavailable",
    });
  });

  it("fails closed when Bid is slower than the timeout", async () => {
    const { options } = setup();
    const fetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    expect(await createHttpStaffToolsAccess({ ...options, fetch }).toolsFor(caller)).toEqual({
      status: "unavailable",
    });
  });

  it("fails closed when the token exchange is slower than the timeout", async () => {
    const { requestToken, options } = setup();
    requestToken.mockReturnValue(new Promise(() => {}));
    const fetch = vi.fn();

    expect(await createHttpStaffToolsAccess({ ...options, fetch }).toolsFor(caller)).toEqual({
      status: "unavailable",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not call anything without the Bid API address", async () => {
    const { requestToken, options } = setup({ baseUrl: undefined });
    const fetch = vi.fn();

    const answer = await createHttpStaffToolsAccess({ ...options, fetch }).toolsFor(caller);

    expect(answer).toEqual({ status: "unavailable" });
    expect(requestToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
