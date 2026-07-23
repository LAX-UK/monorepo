import { describe, expect, it } from "vitest";
import {
  ALL_LIVE_DOMAIN_EVENT_TYPES,
  DOMAIN_EVENT_REGISTRY,
  bidFirstForUserPayloadSchemaV1,
  bidOutbidPayloadSchemaV1,
  parseDomainEventPayload,
  userLinkedExternalPayloadSchemaV1,
} from "./index.js";

describe("DOMAIN_EVENT_REGISTRY", () => {
  it("has a unique key per live event type", () => {
    const keys = Object.keys(DOMAIN_EVENT_REGISTRY);
    expect(keys.length).toBe(new Set(keys).size);
    expect(keys.sort()).toEqual([...ALL_LIVE_DOMAIN_EVENT_TYPES].sort());
  });

  it("parses v1 fixtures for newly frozen bid/user events", () => {
    const firstBid = {
      bidId: "11111111-1111-4111-8111-111111111111",
      lotId: "22222222-2222-4222-8222-222222222222",
      userId: "user_1",
      amountCents: 50_000,
      placedAt: "2026-07-21T12:00:00.000Z",
    };
    expect(parseDomainEventPayload("bid.first_for_user", 1, firstBid)).toEqual({
      ok: true,
      data: bidFirstForUserPayloadSchemaV1.parse(firstBid),
    });

    const outbid = {
      previousBidId: "33333333-3333-4333-8333-333333333333",
      lotId: "22222222-2222-4222-8222-222222222222",
      userId: "user_1",
      newHighAmountCents: 55_000,
    };
    expect(parseDomainEventPayload("bid.outbid", 1, outbid)).toEqual({
      ok: true,
      data: bidOutbidPayloadSchemaV1.parse(outbid),
    });

    const linked = {
      userId: "user_1",
      provider: "google",
      externalId: "sub_123",
      linkedAt: "2026-07-21T12:00:00.000Z",
    };
    expect(parseDomainEventPayload("user.linked_external", 1, linked)).toEqual({
      ok: true,
      data: userLinkedExternalPayloadSchemaV1.parse(linked),
    });
  });

  it("fails safely for unknown schema versions", () => {
    const result = parseDomainEventPayload("bid.outbid", 99, {
      previousBidId: "33333333-3333-4333-8333-333333333333",
      lotId: "22222222-2222-4222-8222-222222222222",
      userId: "user_1",
      newHighAmountCents: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Unsupported schema version 99");
    }
  });
});
