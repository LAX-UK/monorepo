import { emailHash } from "@auction/email";
import { describe, expect, it } from "vitest";
import { mapCampaignsContact, mapCampaignsSubscriber } from "./campaigns-suppression-event.js";

describe("mapCampaignsContact", () => {
  it("maps an unsubscribed contact to a marketing opt-out", () => {
    const result = mapCampaignsContact("unsubscribed", {
      contact_email: "  Buyer@Example.com ",
      unsubscribed_time: "2026-11-01T10:00:00Z",
    });
    expect(result).toEqual({
      ok: true,
      event: {
        emailHash: emailHash("buyer@example.com"),
        reason: "unsubscribed_marketing",
        occurredAt: new Date("2026-11-01T10:00:00Z"),
      },
    });
  });

  it("maps a hard bounce to a hard bounce", () => {
    const result = mapCampaignsContact("bounced", {
      contact_email: "gone@example.com",
      bounced_time: 1793527200000,
      bounce_type: "Hard",
    });
    expect(result).toEqual({
      ok: true,
      event: {
        emailHash: emailHash("gone@example.com"),
        reason: "hard_bounce",
        occurredAt: new Date(1793527200000),
      },
    });
  });

  it("skips a soft bounce, which LAX judges by its own threshold", () => {
    expect(
      mapCampaignsContact("bounced", { contact_email: "full@example.com", bounce_type: "soft" }),
    ).toEqual({ ok: false, skip: "soft_bounce" });
  });

  it("skips a bounce with no or an unknown type rather than silence the address", () => {
    expect(mapCampaignsContact("bounced", { contact_email: "a@example.com" })).toEqual({
      ok: false,
      skip: "unknown_bounce_type",
    });
    expect(
      mapCampaignsContact("bounced", { contact_email: "a@example.com", bounce_type: "other" }),
    ).toEqual({ ok: false, skip: "unknown_bounce_type" });
  });

  it("skips a row without a usable address", () => {
    expect(mapCampaignsContact("unsubscribed", {})).toEqual({ ok: false, skip: "no_email" });
    expect(mapCampaignsContact("unsubscribed", { contact_email: "nope" })).toEqual({
      ok: false,
      skip: "no_email",
    });
  });

  it("still suppresses when the time cannot be read, with no time", () => {
    const result = mapCampaignsContact("unsubscribed", {
      contact_email: "a@example.com",
      unsubscribed_time: "last Tuesday",
    });
    expect(result).toMatchObject({ ok: true, event: { occurredAt: null } });
  });
});

describe("mapCampaignsSubscriber", () => {
  it("maps a subscribed contact to a hash and the time they subscribed", () => {
    expect(
      mapCampaignsSubscriber({
        contact_email: " Reader@Example.com",
        subscribed_time: "2026-11-01T10:00:00Z",
      }),
    ).toEqual({
      ok: true,
      subscriber: {
        emailHash: emailHash("reader@example.com"),
        subscribedAt: new Date("2026-11-01T10:00:00Z"),
      },
    });
  });

  it("skips a row with no address or no subscribe time; an edit time is not a subscribe time", () => {
    expect(mapCampaignsSubscriber({ subscribed_time: "2026-11-01T10:00:00Z" })).toEqual({
      ok: false,
      skip: "no_email",
    });
    expect(
      mapCampaignsSubscriber({
        contact_email: "a@example.com",
        modified_time: "2026-11-01T10:00:00Z",
      }),
    ).toEqual({ ok: false, skip: "no_subscribe_time" });
  });
});
