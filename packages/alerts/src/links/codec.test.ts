import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AlertLinkCodec, type LinkPayload } from "./codec.js";

const now = new Date("2026-11-03T09:00:00Z");
const k1 = { id: "k1", secret: "first-key-for-tests-0123456789" }; // gitleaks:allow
const k2 = { id: "k2", secret: "second-key-for-tests-0123456789" }; // gitleaks:allow
const payload: LinkPayload = {
  kind: "confirm",
  product: "bid",
  subscriberId: "0b8a8e0e-1111-4222-8333-444455556666",
  linkVersion: 1,
  requestedAtMs: 1_700_000_000_000,
};

describe("AlertLinkCodec", () => {
  const codec = new AlertLinkCodec({ signing: k1, accepted: [k1] });

  it("round-trips a link", () => {
    expect(codec.verify(codec.create(payload), now)).toEqual({ payload, legacy: false });
  });

  it("carries a topic on a stop link", () => {
    const { requestedAtMs: _unused, ...rest } = payload;
    const stop: LinkPayload = { ...rest, kind: "stop", topic: "bid.searches" };
    expect(codec.verify(codec.create(stop), now)?.payload).toEqual(stop);
  });

  it("rejects an altered body, a foreign signature and malformed tokens", () => {
    const token = codec.create(payload);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ kid: "k1", k: "stop", p: "bid", s: "other", v: 1 }),
    ).toString("base64url");
    expect(codec.verify(`${forged}.${sig}`, now)).toBeNull();
    expect(codec.verify(`${body}.AAAA`, now)).toBeNull();
    expect(codec.verify(`${body}`, now)).toBeNull();
    expect(codec.verify(`${token}.extra`, now)).toBeNull();
    expect(codec.verify("", now)).toBeNull();
    expect(codec.verify("not.a.token", now)).toBeNull();
  });

  it("never verifies a link for a product other than the one it names", () => {
    const token = codec.create(payload);
    const [body] = token.split(".");
    const wire = JSON.parse(Buffer.from(body ?? "", "base64url").toString());
    const moved = Buffer.from(JSON.stringify({ ...wire, p: "shop" })).toString("base64url");
    expect(codec.verify(`${moved}.${token.split(".")[1]}`, now)).toBeNull();
  });

  it("signs with the current key and accepts the previous one during a rotation", () => {
    const oldCodec = new AlertLinkCodec({ signing: k1, accepted: [k1] });
    const rotated = new AlertLinkCodec({ signing: k2, accepted: [k2, k1] });
    expect(rotated.verify(oldCodec.create(payload), now)?.payload).toEqual(payload);
    expect(oldCodec.verify(rotated.create(payload), now)).toBeNull();
    const retired = new AlertLinkCodec({ signing: k2, accepted: [k2] });
    expect(retired.verify(oldCodec.create(payload), now)).toBeNull();
  });
});

describe("legacy links", () => {
  const secret = "old-account-unsubscribe-secret-0123"; // gitleaks:allow
  const until = new Date("2027-02-01T00:00:00Z");
  const codec = new AlertLinkCodec({ signing: k1, accepted: [k1] }, { secret, acceptUntil: until });

  function legacyToken(data: Record<string, unknown>) {
    const body = Buffer.from(JSON.stringify(data)).toString("base64url");
    const sig = createHmac("sha256", secret)
      .update(`visitor-sale-alerts.v1.${body}`)
      .digest("base64url");
    return `${body}.${sig}`;
  }

  it("reads an old confirm link as a confirm link for Bid at link version 1", () => {
    const verified = codec.verify(
      legacyToken({ kind: "confirm", subscriberId: "abc", requestedAtMs: 5 }),
      now,
    );
    expect(verified).toEqual({
      legacy: true,
      payload: {
        kind: "confirm",
        product: "bid",
        subscriberId: "abc",
        linkVersion: 1,
        requestedAtMs: 5,
      },
    });
  });

  it("reads an old unsubscribe link as a stop link", () => {
    const verified = codec.verify(legacyToken({ kind: "unsubscribe", subscriberId: "abc" }), now);
    expect(verified?.payload).toMatchObject({ kind: "stop", product: "bid", subscriberId: "abc" });
  });

  it("stops accepting old links after the window", () => {
    const token = legacyToken({ kind: "unsubscribe", subscriberId: "abc" });
    expect(codec.verify(token, new Date("2027-02-01T00:00:00Z"))).not.toBeNull();
    expect(codec.verify(token, new Date("2027-02-01T00:00:01Z"))).toBeNull();
  });

  it("rejects old links with the wrong secret or without a policy", () => {
    const token = legacyToken({ kind: "unsubscribe", subscriberId: "abc" });
    const other = new AlertLinkCodec(
      { signing: k1, accepted: [k1] },
      { secret: "different-secret-0123456789abcd", acceptUntil: until }, // gitleaks:allow
    );
    expect(other.verify(token, now)).toBeNull();
    expect(new AlertLinkCodec({ signing: k1, accepted: [k1] }).verify(token, now)).toBeNull();
  });
});
