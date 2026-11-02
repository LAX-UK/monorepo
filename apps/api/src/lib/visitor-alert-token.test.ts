import { describe, expect, it } from "vitest";
import { createVisitorAlertToken, verifyVisitorAlertToken } from "./visitor-alert-token.js";

const secret = "test-secret-0123456789"; // gitleaks:allow

describe("visitor alert tokens", () => {
  it("round-trips a confirm and an unsubscribe token", () => {
    const confirm = createVisitorAlertToken(
      { kind: "confirm", subscriberId: "s1", requestedAtMs: 5 },
      secret,
    );
    expect(verifyVisitorAlertToken(confirm, secret, "confirm")).toEqual({
      kind: "confirm",
      subscriberId: "s1",
      requestedAtMs: 5,
    });
    const unsub = createVisitorAlertToken({ kind: "unsubscribe", subscriberId: "s1" }, secret);
    expect(verifyVisitorAlertToken(unsub, secret, "unsubscribe")?.subscriberId).toBe("s1");
  });

  it("refuses the wrong kind, another secret, a changed body and junk", () => {
    const unsub = createVisitorAlertToken({ kind: "unsubscribe", subscriberId: "s1" }, secret);
    expect(verifyVisitorAlertToken(unsub, secret, "confirm")).toBeNull();
    expect(verifyVisitorAlertToken(unsub, "another-secret-0123456", "unsubscribe")).toBeNull();
    const [, sig] = unsub.split(".");
    const forged = Buffer.from(
      JSON.stringify({ kind: "unsubscribe", subscriberId: "s2" }),
    ).toString("base64url");
    expect(verifyVisitorAlertToken(`${forged}.${sig}`, secret, "unsubscribe")).toBeNull();
    expect(verifyVisitorAlertToken("junk", secret, "unsubscribe")).toBeNull();
    expect(verifyVisitorAlertToken("a.b.c", secret, "unsubscribe")).toBeNull();
  });
});
