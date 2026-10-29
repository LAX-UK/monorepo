import { legalEntityStatuses } from "@auction/types";
import { describe, expect, it } from "vitest";
import { organisationStatusView } from "./organisation-status-presentation";

const SYSTEM_TERMS = /KYB|KYC|Connect|Stripe|lead|_/;

describe("organisationStatusView", () => {
  it.each(legalEntityStatuses)("reads %s in plain, sentence-case words", (status) => {
    const { label, switcherNote } = organisationStatusView(status);
    expect(label).not.toMatch(SYSTEM_TERMS);
    expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
    if (switcherNote) expect(switcherNote).not.toMatch(SYSTEM_TERMS);
  });

  it.each([
    ["approved", "Approved", "success"],
    ["docs_requested", "Documents requested", "warning"],
    ["under_review", "Documents under review", "info"],
    ["docs_received", "Documents under review", "info"],
    ["connect_pending", "Payouts not set up", "warning"],
    ["restricted", "Restricted", "danger"],
    ["rejected", "Not approved", "danger"],
    ["archived", "Closed", "neutral"],
    ["lead", "Documents requested", "warning"],
  ] as const)("shows %s as %s with the %s tone", (status, label, tone) => {
    expect(organisationStatusView(status)).toMatchObject({ label, tone });
  });

  it("notes in the switcher only the states that change what members can do", () => {
    const noted = legalEntityStatuses.filter((s) => organisationStatusView(s).switcherNote);
    expect(noted).toEqual([
      "lead",
      "docs_requested",
      "docs_received",
      "under_review",
      "restricted",
      "rejected",
      "archived",
    ]);
  });
});
