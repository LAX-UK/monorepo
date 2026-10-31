import { describe, expect, it } from "vitest";
import {
  inboxApiParams,
  inboxCleared,
  inboxHref,
  inboxNarrowed,
  parseInboxQuery,
} from "./inbox-query";

const ORG = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("inbox query", () => {
  it("opens on Needs action, with its own short address", () => {
    const query = parseInboxQuery({});
    expect(query).toEqual({ tab: "needs_action", type: "", account: "all", q: "" });
    expect(inboxHref(query)).toBe("/notifications");
    expect(inboxHref({ ...query, tab: "archived" })).toBe("/notifications?tab=archived");
  });

  it("keeps a known type, an organisation or Personal, and trimmed words", () => {
    const query = parseInboxQuery({ tab: "unread", type: "payments", account: ORG, q: "  Arles " });
    expect(query).toEqual({ tab: "unread", type: "payments", account: ORG, q: "Arles" });
    expect(parseInboxQuery({ account: "personal" }).account).toBe("personal");
  });

  it("drops what it doesn't know rather than guessing", () => {
    expect(parseInboxQuery({ tab: "spam", type: "everything", account: "northbank" })).toEqual({
      tab: "needs_action",
      type: "",
      account: "all",
      q: "",
    });
  });

  it("asks the API for the view, the filters and the page", () => {
    const query = parseInboxQuery({ tab: "all", account: "personal", q: "invoice" });
    expect(inboxApiParams(query, 20, 20).toString()).toBe(
      "tab=all&limit=20&offset=20&account=personal&q=invoice",
    );
  });

  it("knows when the list is narrowed, and clears back to the whole view", () => {
    const query = parseInboxQuery({ tab: "unread", q: "x" });
    expect(inboxNarrowed(query)).toBe(true);
    expect(inboxNarrowed(inboxCleared(query))).toBe(false);
    expect(inboxCleared(query).tab).toBe("unread");
  });
});
