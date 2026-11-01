import { describe, expect, it } from "vitest";
import type { ActivityEntryView } from "../data/http/organisation-team.types";
import { bankChangeNotice, bankChangedLine } from "./bank-change-notice";

const change = (occurredAt: string, kind = "bank_details_changed"): ActivityEntryView => ({
  id: 1,
  kind,
  group: "money",
  occurredAt,
  actorUserId: "u",
  subjectUserId: null,
  detail: {},
  actorName: "Daniel Reyes",
  subjectName: null,
});

const now = new Date("2026-10-30T12:00:00Z");

describe("bankChangeNotice", () => {
  it("says when and by whom the newest change in the last 30 days was made", () => {
    const notice = bankChangeNotice(
      [change("2026-10-20T10:00:00Z"), change("2026-10-28T14:55:00Z")],
      now,
    );
    expect(notice?.title).toMatch(
      /^The payout account was changed on 28.Oct.2026 by Daniel Reyes\.$/,
    );
  });

  it("is quiet for older changes and other money events", () => {
    expect(bankChangeNotice([change("2026-09-01T10:00:00Z")], now)).toBeNull();
    expect(bankChangeNotice([change("2026-10-28T10:00:00Z", "payout_sent")], now)).toBeNull();
  });
});

describe("bankChangedLine", () => {
  it("says when the newest change was made and by whom, however old", () => {
    expect(
      bankChangedLine([change("2026-03-02T10:00:00Z"), change("2026-01-20T10:00:00Z")]),
    ).toMatch(/^Changed 2.Mar.2026 by Daniel Reyes$/);
  });

  it("is null when no change is in the entries", () => {
    expect(bankChangedLine([change("2026-10-28T10:00:00Z", "payout_sent")])).toBeNull();
  });
});
