import type {
  ArtCommerceMutationClient,
  ArtCommerceMutationResult,
} from "@/lib/art-commerce-mutation.server";
import { describe, expect, it, vi } from "vitest";
import { readFollowEmailsOn, readFollowEmailsStopped, turnOnFollowEmails } from "./follow-emails";

const client = (result: ArtCommerceMutationResult) => {
  const mutate = vi.fn(async () => result);
  return { mutate, client: { mutate } as ArtCommerceMutationClient };
};

describe("readFollowEmailsOn", () => {
  it("reads the followed-artists switch", () => {
    const topics = (emailOn: boolean) => ({
      topics: [
        { topic: "shop.releases", emailOn: !emailOn },
        { topic: "art.followed_artists", emailOn },
      ],
    });
    expect(readFollowEmailsOn(topics(true))).toBe(true);
    expect(readFollowEmailsOn(topics(false))).toBe(false);
  });

  it("says nothing when the answer is missing or off-contract", () => {
    expect(readFollowEmailsOn(null)).toBeNull();
    expect(readFollowEmailsOn({ topics: "x" })).toBeNull();
    expect(readFollowEmailsOn({ topics: [{ topic: "shop.releases", emailOn: true }] })).toBeNull();
    expect(
      readFollowEmailsOn({ topics: [{ topic: "art.followed_artists", emailOn: "yes" }] }),
    ).toBeNull();
  });
});

describe("turnOnFollowEmails", () => {
  it("switches the topic on through the commerce BFF", async () => {
    const { client: c, mutate } = client({ kind: "response", status: 200, body: { ok: true } });
    expect(await turnOnFollowEmails(c)).toEqual({ ok: true });
    expect(mutate).toHaveBeenCalledWith("/commerce/me/email-alerts/topics/art.followed_artists", {
      method: "PUT",
      body: { on: true },
    });
  });

  it("says why it cannot, in plain words", async () => {
    const unverified = client({
      kind: "response",
      status: 409,
      body: { ok: false, reason: "unverified" },
    });
    expect(await turnOnFollowEmails(unverified.client)).toMatchObject({
      ok: false,
      message: expect.stringContaining("Verify your email"),
    });
    const signedOut = client({ kind: "response", status: 401, body: null });
    expect(await turnOnFollowEmails(signedOut.client)).toMatchObject({ ok: false });
    const csrf = client({ kind: "csrf_unavailable" });
    expect(await turnOnFollowEmails(csrf.client)).toMatchObject({ ok: false });
    const down = client({ kind: "network_error" });
    expect(await turnOnFollowEmails(down.client)).toMatchObject({
      ok: false,
      message: expect.stringContaining("Try again"),
    });
  });
});

describe("readFollowEmailsStopped", () => {
  it("is true only when Shop says the person stopped all alerts", () => {
    expect(
      readFollowEmailsStopped({
        topics: [{ topic: "art.followed_artists", emailOn: false, stopped: true }],
      }),
    ).toBe(true);
    expect(
      readFollowEmailsStopped({ topics: [{ topic: "art.followed_artists", emailOn: false }] }),
    ).toBe(false);
    expect(readFollowEmailsStopped(null)).toBe(false);
    expect(
      readFollowEmailsStopped({
        topics: [{ topic: "shop.releases", emailOn: false, stopped: true }],
      }),
    ).toBe(false);
  });
});
