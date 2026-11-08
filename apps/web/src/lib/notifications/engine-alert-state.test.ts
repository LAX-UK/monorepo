import type { AccountAlerts } from "@/lib/data/http/alerts.server";
import { describe, expect, it } from "vitest";
import { engineAlertStateOf, searchTopicEmailOn } from "./engine-alert-state";

const mine = (state: AccountAlerts["state"], emailOn: boolean): AccountAlerts => ({
  state,
  linked: true,
  topics: [{ topic: "bid.searches", emailOn }],
});

describe("engineAlertStateOf", () => {
  it("reads nothing for an unreadable client and no subscription once stopped", () => {
    expect(engineAlertStateOf(null)).toBeNull();
    expect(engineAlertStateOf(mine("stopped", true))?.email["bid.searches"]).toBe(false);
  });
});

describe("searchTopicEmailOn", () => {
  it("follows the topic's email while confirmed", () => {
    expect(searchTopicEmailOn(mine("confirmed", true), true)).toBe(true);
    expect(searchTopicEmailOn(mine("confirmed", false), true)).toBe(false);
  });

  it("is off once alerts were stopped", () => {
    expect(searchTopicEmailOn(mine("stopped", true), true)).toBe(false);
  });

  it("is off for an address that is not verified", () => {
    expect(searchTopicEmailOn(mine("confirmed", true), false)).toBe(false);
  });

  it("is unknown only when the read failed or the topic has no row", () => {
    expect(searchTopicEmailOn(null, true)).toBeNull();
    expect(searchTopicEmailOn({ state: "none", linked: false, topics: [] }, true)).toBeNull();
  });
});
