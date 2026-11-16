import { describe, expect, it, vi } from "vitest";
import type { CreateNotificationRow } from "../interfaces/notification-write.repository.js";
import {
  defaultNotificationPreference,
  inAppPreferenceKey,
} from "./notification-preference-keys.js";
import { PreferenceAwareNotificationWriter } from "./preference-aware-notification-writer.js";

const row = (userId: string, type: string): CreateNotificationRow => ({
  userId,
  type,
  title: "t",
  message: "m",
  legalEntityId: null,
});

function setup(off: Record<string, string[]>) {
  const written: CreateNotificationRow[][] = [];
  const inner = {
    createMany: vi.fn(async (rows: CreateNotificationRow[]) => {
      written.push(rows);
      return [];
    }),
  };
  const preferences = {
    isChannelEnabled: vi.fn(async (userId: string, type: string) => {
      const prefs = { ...defaultNotificationPreference(userId), ...flags(off[userId]) };
      const key = inAppPreferenceKey(type);
      return key ? prefs[key] !== false : true;
    }),
  };
  const writer = new PreferenceAwareNotificationWriter(inner, preferences, [
    "sale_registration_decided",
    "bidding_limit_changed",
  ]);
  return { writer, written, preferences };
}

const flags = (names: string[] = []) => Object.fromEntries(names.map((n) => [n, false]));

describe("PreferenceAwareNotificationWriter", () => {
  it("drops a governed notice when the person's app switch is off, and keeps the rest", async () => {
    const { writer, written } = setup({ a: ["registrationInApp"] });
    await writer.createMany([
      row("a", "sale_registration_decided"),
      row("a", "bidding_limit_changed"),
      row("b", "sale_registration_decided"),
    ]);
    expect(written[0]?.map((r) => `${r.userId}:${r.type}`)).toEqual([
      "b:sale_registration_decided",
    ]);
  });

  it("delivers a governed notice when the switch is on, which is the default", async () => {
    const { writer, written } = setup({});
    await writer.createMany([row("a", "sale_registration_decided")]);
    expect(written[0]).toHaveLength(1);
  });

  it("never asks about, or drops, a type it does not govern", async () => {
    const { writer, written, preferences } = setup({ a: ["paymentInApp", "registrationInApp"] });
    await writer.createMany([row("a", "payment_due")]);
    expect(written[0]).toHaveLength(1);
    expect(preferences.isChannelEnabled).not.toHaveBeenCalled();
  });
});
