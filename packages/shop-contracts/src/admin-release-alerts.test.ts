import "./contract-formats.js";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import {
  AdminReleaseAlertSendListSchema,
  AdminReleaseAlertSendsQuerySchema,
} from "./admin-release-alerts.js";

const row = {
  artworkId: "11111111-1111-4111-8111-111111111111",
  title: "Harbour at dusk, edition of 50",
  imageUrl: null,
  publishedAt: "2026-11-14T10:30:00.000Z",
  publishedByName: null,
  toldSubscribers: true,
  status: "sending",
  matched: 3,
  emailed: 1,
  waiting: 1,
  notSent: 1,
  notSentReasons: [{ reason: "topic_off", count: 1 }],
};

describe("release-alert send log contract", () => {
  it("accepts a page of releases", () => {
    expect(Value.Check(AdminReleaseAlertSendListSchema, { items: [row], nextCursor: null })).toBe(
      true,
    );
  });

  it("has no room for a subscriber: an extra field is refused", () => {
    const leaky = { ...row, recipients: ["someone@example.com"] };
    expect(Value.Check(AdminReleaseAlertSendListSchema, { items: [leaky], nextCursor: null })).toBe(
      false,
    );
  });

  it("knows only the five statuses and never a negative count", () => {
    for (const status of ["not_announced", "queued", "sending", "sent", "not_sent_yet"]) {
      expect(
        Value.Check(AdminReleaseAlertSendListSchema, {
          items: [{ ...row, status }],
          nextCursor: null,
        }),
      ).toBe(true);
    }
    expect(
      Value.Check(AdminReleaseAlertSendListSchema, {
        items: [{ ...row, status: "stuck" }],
        nextCursor: null,
      }),
    ).toBe(false);
    expect(
      Value.Check(AdminReleaseAlertSendListSchema, {
        items: [{ ...row, waiting: -1 }],
        nextCursor: null,
      }),
    ).toBe(false);
  });

  it("bounds the page size", () => {
    expect(Value.Check(AdminReleaseAlertSendsQuerySchema, { limit: 50 })).toBe(true);
    expect(Value.Check(AdminReleaseAlertSendsQuerySchema, { limit: 51 })).toBe(false);
    expect(Value.Check(AdminReleaseAlertSendsQuerySchema, { limit: 0 })).toBe(false);
  });
});
