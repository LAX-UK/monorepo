import type { UserNotificationListItem } from "@auction/types";
import { describe, expect, it } from "vitest";
import { type InboxAccounts, inboxRowView } from "./inbox-row.vm";

const NORTH = "aaaaaaaa-0000-4000-8000-000000000001";
const CEDAR = "aaaaaaaa-0000-4000-8000-000000000002";
const ME = "aaaaaaaa-0000-4000-8000-000000000009";

const accounts: InboxAccounts = {
  currentId: NORTH,
  options: [
    { id: ME, kind: "personal", name: "Personal", initials: "MO" },
    { id: NORTH, kind: "organisation", name: "Northbank Gallery", initials: "NG" },
    { id: CEDAR, kind: "organisation", name: "Cedar & Stone Fine Art", initials: "CS" },
  ],
};

function item(overrides: Partial<UserNotificationListItem> = {}): UserNotificationListItem {
  return {
    id: "n1",
    userId: "u1",
    type: "outbid",
    title: 'You were outbid on "Sun over Arles"',
    message: "Lot 88 closes today at 18:12.",
    lotId: "l88",
    submissionId: null,
    read: false,
    createdAt: new Date("2026-10-31T14:02:00Z"),
    account: {
      legalEntityId: NORTH,
      kind: "organisation",
      displayName: "Northbank Gallery",
      canSwitch: true,
    },
    needsAction: true,
    ...overrides,
  };
}

describe("inboxRowView", () => {
  it("opens a notification for the account in use in place, tagged with that account", () => {
    const row = inboxRowView(item(), accounts, new Set());
    expect(row.account).toEqual({
      kind: "organisation",
      name: "Northbank Gallery",
      initials: "NG",
    });
    expect(row.href).toMatch(/^\/lot\//);
    expect(row.switchesAccount).toBe(false);
    expect(row.mute).toEqual({ legalEntityId: NORTH, name: "Northbank Gallery", muted: false });
  });

  it("opens another organisation's notification through the switch hop, with the way back", () => {
    const row = inboxRowView(
      item({
        account: {
          legalEntityId: CEDAR,
          kind: "organisation",
          displayName: "Cedar & Stone Fine Art",
          canSwitch: true,
        },
      }),
      accounts,
      new Set([CEDAR]),
    );
    expect(row.switchesAccount).toBe(true);
    const url = new URL(row.href ?? "", "https://bid.test");
    expect(url.pathname).toBe("/switch-account");
    expect(url.searchParams.get("to")).toBe(CEDAR);
    expect(url.searchParams.get("from")).toBe(NORTH);
    expect(row.mute?.muted).toBe(true);
  });

  it("tags a personal notification Personal and opens it in the personal account", () => {
    const row = inboxRowView(item({ account: null }), accounts, new Set());
    expect(row.account.name).toBe("Personal");
    expect(new URL(row.href ?? "", "https://bid.test").searchParams.get("to")).toBe(ME);
    expect(row.mute).toBeNull();
  });

  it("never offers to mute or switch into an organisation the person left", () => {
    const row = inboxRowView(
      item({
        account: {
          legalEntityId: CEDAR,
          kind: "organisation",
          displayName: "Harrington Advisors",
          canSwitch: false,
        },
      }),
      accounts,
      new Set(),
    );
    expect(row.mute).toBeNull();
    expect(row.switchesAccount).toBe(false);
    // The hop explains there is no access rather than opening it in the wrong account.
    expect(row.href).toMatch(/^\/switch-account\?/);
  });

  it("has nothing to open for a notice without a page", () => {
    expect(inboxRowView(item({ lotId: null, type: "lot_lost" }), accounts, new Set()).href).toBe(
      null,
    );
  });
});
