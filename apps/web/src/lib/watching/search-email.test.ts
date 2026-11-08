import { describe, expect, it, vi } from "vitest";
import {
  type SearchEmailPorts,
  needsOthersConfirmation,
  othersConfirmationText,
  savedWhileHeldMessage,
  searchEmailControl,
  switchSearchEmail,
  turnedOnMessage,
} from "./search-email";

const ports = (over: Partial<SearchEmailPorts> = {}): SearchEmailPorts => ({
  setSearch: vi.fn().mockResolvedValue(true),
  enableTopicEmail: vi.fn().mockResolvedValue({ ok: true }),
  ...over,
});

const on = { id: "s1", on: true, previous: false, access: "ok" as const };

describe("searchEmailControl", () => {
  it("is held, with the reason and where to fix it, once alerts were stopped", () => {
    expect(
      searchEmailControl({ access: "stopped", notifyEmail: true, topicEmailOn: true }),
    ).toEqual({
      kind: "held",
      reason: "You stopped all alerts",
      action: { label: "Turn alerts back on", href: "/settings#alerts" },
    });
  });

  it("is held for an address that is not verified", () => {
    expect(
      searchEmailControl({ access: "unverified", notifyEmail: true, topicEmailOn: true }),
    ).toMatchObject({
      kind: "held",
      reason: "Verify your email address to get alerts",
      action: { label: "Verify your email" },
    });
  });

  it("reads on only while the search and the topic are both on, and says why when the topic is off", () => {
    expect(searchEmailControl({ access: "ok", notifyEmail: true, topicEmailOn: true })).toEqual({
      kind: "switch",
      checked: true,
    });
    expect(searchEmailControl({ access: "ok", notifyEmail: true, topicEmailOn: null })).toEqual({
      kind: "switch",
      checked: true,
    });
    expect(searchEmailControl({ access: "ok", notifyEmail: true, topicEmailOn: false })).toEqual({
      kind: "switch",
      checked: false,
      description: expect.stringMatching(/^Email is off for saved searches/),
    });
  });
});

describe("confirming the others", () => {
  it("asks only when the topic is off and other searches have their own switch on", () => {
    expect(needsOthersConfirmation({ topicEmailOn: false, othersOn: 2 })).toBe(true);
    expect(needsOthersConfirmation({ topicEmailOn: false, othersOn: 0 })).toBe(false);
    expect(needsOthersConfirmation({ topicEmailOn: true, othersOn: 2 })).toBe(false);
    expect(needsOthersConfirmation({ topicEmailOn: null, othersOn: 2 })).toBe(false);
  });

  it("says exactly how many", () => {
    expect(othersConfirmationText(1)).toBe(
      "This also turns on email for 1 other saved search that already had it switched on.",
    );
    expect(othersConfirmationText(3)).toContain("3 other saved searches");
    expect(turnedOnMessage(0)).toBe("Email alerts are on for this search");
    expect(turnedOnMessage(2)).toBe(
      "Email alerts are on for this search and 2 other saved searches",
    );
  });
});

describe("an unreadable alert state", () => {
  it("is held, with a reason and a place to look, and calls nothing", async () => {
    expect(
      searchEmailControl({ access: "unreadable", notifyEmail: true, topicEmailOn: null }),
    ).toMatchObject({
      kind: "held",
      reason: "We couldn't check your alert settings. Try again.",
    });
    const p = ports();
    const result = await switchSearchEmail({ ...on, access: "unreadable" }, p);
    expect(result).toEqual({
      ok: false,
      error: "We couldn't check your alert settings. Try again.",
    });
    expect(p.setSearch).not.toHaveBeenCalled();
    expect(p.enableTopicEmail).not.toHaveBeenCalled();
  });
});

describe("savedWhileHeldMessage", () => {
  it("says why nothing will be sent", () => {
    expect(savedWhileHeldMessage("stopped")).toBe(
      "Alert saved. You stopped all alerts, so nothing will be sent.",
    );
    expect(savedWhileHeldMessage("unverified")).toBe(
      "Alert saved. Verify your email address to get alerts.",
    );
  });
});

describe("switchSearchEmail", () => {
  it("sets the search first, then the topic", async () => {
    const order: string[] = [];
    const p = ports({
      setSearch: vi.fn().mockImplementation(async () => order.push("search") > 0),
      enableTopicEmail: vi.fn().mockImplementation(async () => {
        order.push("topic");
        return { ok: true };
      }),
    });
    expect(await switchSearchEmail(on, p)).toEqual({ ok: true });
    expect(order).toEqual(["search", "topic"]);
  });

  it("changes nothing while alerts are stopped or the address is unverified", async () => {
    for (const access of ["stopped", "unverified"] as const) {
      const p = ports();
      const result = await switchSearchEmail({ ...on, access }, p);
      expect(result.ok).toBe(false);
      expect(p.setSearch).not.toHaveBeenCalled();
      expect(p.enableTopicEmail).not.toHaveBeenCalled();
    }
  });

  it("puts the search back when the topic step fails", async () => {
    const p = ports({
      enableTopicEmail: vi
        .fn()
        .mockResolvedValue({ ok: false, error: "Alerts to this address were stopped." }),
    });
    expect(await switchSearchEmail(on, p)).toEqual({
      ok: false,
      error: "Alerts to this address were stopped.",
    });
    expect(p.setSearch).toHaveBeenNthCalledWith(1, "s1", true);
    expect(p.setSearch).toHaveBeenNthCalledWith(2, "s1", false);
  });

  it("says exactly what was saved when putting it back fails too", async () => {
    const p = ports({
      setSearch: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
      enableTopicEmail: vi.fn().mockResolvedValue({ ok: false, error: "Try again." }),
    });
    expect(await switchSearchEmail(on, p)).toEqual({
      ok: false,
      error: "Email is on for this search, but saved-search alerts are still off. Try again.",
    });
  });

  it("leaves a search that was already on as it was when the topic step fails", async () => {
    const p = ports({
      enableTopicEmail: vi.fn().mockResolvedValue({ ok: false, error: "Try again." }),
    });
    await switchSearchEmail({ ...on, previous: true }, p);
    expect(p.setSearch).toHaveBeenCalledTimes(1);
  });

  it("does not touch the topic when the search could not be saved", async () => {
    const p = ports({ setSearch: vi.fn().mockResolvedValue(false) });
    expect(await switchSearchEmail(on, p)).toMatchObject({ ok: false });
    expect(p.enableTopicEmail).not.toHaveBeenCalled();
  });

  it("switches only the topic on when there is no search id", async () => {
    const p = ports();
    expect(await switchSearchEmail({ ...on, id: null }, p)).toEqual({ ok: true });
    expect(p.enableTopicEmail).toHaveBeenCalled();
    expect(p.setSearch).not.toHaveBeenCalled();
  });

  it("turns off only the search", async () => {
    const p = ports();
    expect(await switchSearchEmail({ ...on, on: false, previous: true }, p)).toEqual({ ok: true });
    expect(p.enableTopicEmail).not.toHaveBeenCalled();
    expect(p.setSearch).toHaveBeenCalledWith("s1", false);
  });

  it("reports a failed save when turning off", async () => {
    const p = ports({ setSearch: vi.fn().mockResolvedValue(false) });
    expect(await switchSearchEmail({ ...on, on: false }, p)).toMatchObject({ ok: false });
  });
});
