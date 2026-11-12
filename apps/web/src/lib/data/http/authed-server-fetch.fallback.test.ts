import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const send = vi.fn();
vi.mock("./ssr-key-retry.server", () => ({
  isReplayableBody: () => true,
  sendWithSsrKeyRetry: (input: { send: (h: Headers) => Promise<Response> }) => send(input),
}));
vi.mock("./hc-server", () => ({ getServerApiBase: () => "http://api" }));
vi.mock("@/lib/data/http/server-request-headers", () => ({
  buildAuthedSsrHeaders: async () => new Headers(),
}));

import { authedServerFetchWithEntityFallback } from "./authed-server-fetch";

const refusal = (code: string) =>
  new Response(JSON.stringify({ error: code, code }), { status: 403 });

describe("authedServerFetchWithEntityFallback", () => {
  beforeEach(() => send.mockReset());

  it("retries without the acting header on a plain membership 403", async () => {
    send.mockResolvedValueOnce(refusal("not_a_member_of_legal_entity"));
    send.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const res = await authedServerFetchWithEntityFallback("/x");
    expect(send).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });

  it.each(["impersonation_session_expired", "invalid_impersonation_session"])(
    "does not retry when the view session is over (%s)",
    async (code) => {
      send.mockResolvedValueOnce(refusal(code));
      const res = await authedServerFetchWithEntityFallback("/x");
      expect(send).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(403);
    },
  );

  it("retries without the acting header when the 403 body is not JSON", async () => {
    send.mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));
    send.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const res = await authedServerFetchWithEntityFallback("/x");
    expect(send).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });
});
