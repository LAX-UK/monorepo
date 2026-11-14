import { describe, expect, it } from "vitest";
import {
  onboardingEmptyCopy,
  onboardingListHref,
  onboardingMetrics,
  onboardingNextStep,
  onboardingRangeSummary,
  onboardingViews,
  toOnboardingStaffRow,
  toOnboardingStaffRows,
} from "./onboarding-issues-staff-list.vm";

const NOW = new Date("2026-10-25T12:00:00.000Z");
const RETURN_TO = "/admin/onboarding-issues?tab=kyc";

const entity = {
  id: "le_1",
  displayName: "Hollis Gallery Ltd",
  status: "documents_received",
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-02T09:00:00.000Z",
  statusChangedAt: null,
};
const kyc = {
  id: "kyc_1",
  userId: "user_1",
  userName: "Ada Lovelace",
  userEmail: "ada@example.test",
  provider: "Stripe Identity",
  status: "requires_input",
  createdAt: "2026-10-24T09:00:00.000Z",
};
const document = {
  id: "doc_1",
  legalEntityId: "le_1",
  entityDisplayName: "Hollis Gallery Ltd",
  uploadObjectId: "obj_1",
  uploadedAt: "2026-10-18T09:00:00.000Z",
};

describe("onboarding issues staff list view model", () => {
  it("reads each queue's rows into one shape, with the page that settles the item", () => {
    expect(toOnboardingStaffRow("entities", entity, RETURN_TO, NOW)).toMatchObject({
      title: "Hollis Gallery Ltd",
      kind: "Legal entity",
      hrefLabel: "Open legal entity",
      href: "/admin/legal-entities/le_1?returnTo=%2Fadmin%2Fonboarding-issues%3Ftab%3Dkyc",
    });
    expect(toOnboardingStaffRow("kyc", kyc, undefined, NOW)).toMatchObject({
      title: "Ada Lovelace",
      email: "ada@example.test",
      secondary: "Stripe Identity",
      href: "/admin/clients/user_1",
      hrefLabel: "Open client",
    });
    expect(toOnboardingStaffRow("documents", document, undefined, NOW)).toMatchObject({
      title: "Hollis Gallery Ltd",
      secondary: "Document awaiting review",
      href: "/admin/legal-entities/le_1?tab=documents",
    });
  });

  it("names the status in words, and leaves it out where the queue has none", () => {
    expect(toOnboardingStaffRow("entities", entity, undefined, NOW)?.status?.label).not.toMatch(
      /_/,
    );
    expect(toOnboardingStaffRow("kyc", kyc, undefined, NOW)?.status?.label).toBe("Requires input");
    expect(
      toOnboardingStaffRow(
        "artists",
        { id: "a_1", displayName: "Sam Rowe", status: "pending", createdAt: entity.createdAt },
        undefined,
        NOW,
      )?.status,
    ).toBeNull();
  });

  it("marks how long an item has waited", () => {
    expect(toOnboardingStaffRow("kyc", kyc, undefined, NOW)).toMatchObject({
      ageLabel: "1d ago",
      urgency: "none",
    });
    expect(toOnboardingStaffRow("documents", document, undefined, NOW)).toMatchObject({
      urgency: "attention",
    });
    expect(toOnboardingStaffRow("entities", entity, undefined, NOW)).toMatchObject({
      ageLabel: "Thu 1 Oct",
      urgency: "stale",
    });
  });

  it("leaves out a row that does not fit its queue", () => {
    expect(
      toOnboardingStaffRows("kyc", [entity, kyc], undefined, NOW).map((row) => row.id),
    ).toEqual(["kyc_1"]);
  });

  it("lays the queues out as tabs, with a count only where something waits", () => {
    const views = onboardingViews(
      { tab: "kyc", offset: "50", item: "kyc_1" },
      { queueTotal: 5, entities: 3, artists: 0, kyc: 2, orgs: 0, documents: 0 },
    );
    expect(views.map((view) => [view.id, view.count])).toEqual([
      ["entities", 3],
      ["artists", undefined],
      ["kyc", 2],
      ["orgs", undefined],
      ["documents", undefined],
    ]);
    expect(views[1]?.href).toBe("/admin/onboarding-issues?tab=artists");
  });

  it("restarts paging and closes the panel when the list changes, unless told otherwise", () => {
    const search = { tab: "kyc", offset: "50", item: "kyc_1", limit: "25" };
    expect(onboardingListHref(search, { limit: 100 })).toBe(
      "/admin/onboarding-issues?tab=kyc&limit=100",
    );
    expect(onboardingListHref(search, { offset: 75, item: "kyc_1" })).toBe(
      "/admin/onboarding-issues?tab=kyc&offset=75&item=kyc_1&limit=25",
    );
  });

  it("summarises the open queue in at most four numbers", () => {
    expect(
      onboardingMetrics({
        tab: "kyc",
        summary: { total: 4, created: 2, requiresInput: 1, processing: 1 },
      }).map((metric) => [metric.label, metric.value]),
    ).toEqual([
      ["Sessions waiting", "4"],
      ["Not started", "2"],
      ["Needs input", "1"],
      ["Processing", "1"],
    ]);
    expect(onboardingMetrics(null)).toEqual([]);
  });

  it("says whether everything is resolved or only this queue is empty", () => {
    expect(onboardingEmptyCopy("kyc", 0).title).toBe("All onboarding issues resolved");
    expect(onboardingEmptyCopy("kyc", 3).title).toBe("No KYC sessions waiting");
    expect(onboardingRangeSummary(50, 50, 312)).toBe("51–100 of 312 items");
  });

  it("says what holds each item up, who it waits on and the next step", () => {
    expect(toOnboardingStaffRow("kyc", kyc, undefined, NOW)?.nextStep).toMatchObject({
      waitingOn: "The client",
      blocker: "The provider needs more from the client",
    });
    expect(toOnboardingStaffRow("documents", document, undefined, NOW)?.nextStep).toMatchObject({
      waitingOn: "Staff",
      action: "Approve or reject it on the entity's Documents tab.",
    });
    expect(onboardingNextStep("entities", "docs_received").action).toMatch(/^Start the review/);
    expect(onboardingNextStep("entities", "under_review").action).toMatch(
      /^Approve and move to Connect/,
    );
    expect(onboardingNextStep("kyc", "processing").waitingOn).toBe("The provider");
    expect(onboardingNextStep("kyc", "created").blocker).toBe("Identity check not finished");
    expect(onboardingNextStep("artists", "pending").action).toMatch(/approve or reject/);
    expect(onboardingNextStep("orgs", null).waitingOn).toBe("The organisation");
  });
});
