import { describe, expect, it } from "vitest";
import { connectLoadErrorOf } from "./stripe-connect-load-error";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("connectLoadErrorOf", () => {
  it("reads an account Stripe will not show us as unreachable", async () => {
    await expect(
      connectLoadErrorOf(json(409, { error: "stripe_account_unreachable" })),
    ).resolves.toBe("account_unreachable");
  });

  it("keeps the other outcomes", async () => {
    await expect(connectLoadErrorOf(json(401, {}))).resolves.toBe("unauthorized");
    await expect(connectLoadErrorOf(json(404, {}))).resolves.toBe("not_connected");
    await expect(connectLoadErrorOf(json(409, { error: "other" }))).resolves.toBe("server_error");
    await expect(connectLoadErrorOf(new Response("oops", { status: 500 }))).resolves.toBe(
      "server_error",
    );
  });
});
