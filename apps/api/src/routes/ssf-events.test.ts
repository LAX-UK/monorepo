import { beforeEach, describe, expect, it, vi } from "vitest";
import { StaleSsfSignalError } from "../services/interfaces/ssf-signal.js";

const verifyAndConsumeSet = vi.fn();

vi.mock("@auction/identity-contracts", async (importOriginal) => {
  const original = await importOriginal<typeof import("@auction/identity-contracts")>();
  return { ...original, verifyAndConsumeSet };
});

const { createBidSsfEventsRoute } = await import("./ssf-events.js");

const baseSignal = {
  issuer: "https://auth.lax.bid",
  audience: "lax-bid-api",
  issuedAt: 1,
  jti: "jti-1",
  subjectId: "user-1",
  event: {},
};

describe("Bid SSF socket revocation publication", () => {
  const publish = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    publish.mockResolvedValue(1);
  });

  it.each([
    ["https://schemas.openid.net/secevent/caep/event-type/credential-change", "credential_change"],
    ["https://schemas.openid.net/secevent/risc/event-type/account-disabled", "account_disabled"],
    [
      "https://schemas.openid.net/secevent/risc/event-type/identifier-recycled",
      "identifier_recycled",
    ],
    ["https://schemas.lax.bid/secevent/identity/event-type/account-merged", "identity_merged"],
  ])("publishes %s only after replay consumption", async (eventType, reason) => {
    verifyAndConsumeSet.mockResolvedValueOnce({ ...baseSignal, eventType });
    const app = createBidSsfEventsRoute({
      replayStore: { consume: vi.fn() },
      issuer: baseSignal.issuer,
      jwksUrl: `${baseSignal.issuer}/jwks`,
      publish,
    });
    const response = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/secevent+jwt" },
      body: "signed-set",
    });

    expect(response.status).toBe(202);
    expect(publish).toHaveBeenCalledWith(
      "identity:socket-revocation:v1",
      JSON.stringify({ version: 1, subject: "user-1", reason }),
    );
    expect(
      verifyAndConsumeSet.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY);
  });

  it("publishes session-revoked sub_id as an RP sid, not a user subject", async () => {
    verifyAndConsumeSet.mockResolvedValueOnce({
      ...baseSignal,
      subjectId: "identity-session-1",
      eventType: "https://schemas.openid.net/secevent/caep/event-type/session-revoked",
    });
    const app = createBidSsfEventsRoute({
      replayStore: { consume: vi.fn() },
      issuer: baseSignal.issuer,
      jwksUrl: `${baseSignal.issuer}/jwks`,
      publish,
    });

    const response = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/secevent+jwt" },
      body: "signed-set",
    });

    expect(response.status).toBe(202);
    expect(publish).toHaveBeenCalledWith(
      "identity:socket-revocation:v1",
      JSON.stringify({
        version: 1,
        sid: "identity-session-1",
        reason: "session_revoked",
      }),
    );
  });

  it("does not publish when SET replay validation rejects", async () => {
    verifyAndConsumeSet.mockRejectedValueOnce(new Error("replayed_set"));
    const app = createBidSsfEventsRoute({
      replayStore: { consume: vi.fn() },
      issuer: baseSignal.issuer,
      jwksUrl: `${baseSignal.issuer}/jwks`,
      publish,
    });
    expect(
      (
        await app.request("/", {
          method: "POST",
          headers: { "content-type": "application/secevent+jwt" },
          body: "signed-set",
        })
      ).status,
    ).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });

  it("acknowledges a stale ordered SET without publishing or requesting retry", async () => {
    verifyAndConsumeSet.mockRejectedValueOnce(new StaleSsfSignalError());
    const app = createBidSsfEventsRoute({
      replayStore: { consume: vi.fn() },
      issuer: baseSignal.issuer,
      jwksUrl: `${baseSignal.issuer}/jwks`,
      publish,
    });

    const response = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/secevent+jwt" },
      body: "signed-set",
    });

    expect(response.status).toBe(202);
    expect(publish).not.toHaveBeenCalled();
  });
});
