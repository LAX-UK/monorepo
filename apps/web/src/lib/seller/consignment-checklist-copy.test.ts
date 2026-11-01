import { type ConsignmentChecklistFacts, computeConsignmentChecklist } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { type ChecklistCopyContext, checklistItemView } from "./consignment-checklist-copy";
import {
  consignmentChecklistFacts,
  organisationIdentityFact,
  personalIdentityFact,
} from "./consignment-checklist-facts";

const personalCtx: ChecklistCopyContext = {
  accountKind: "personal",
  organisationName: null,
  agreementHref: "#agreement",
};
const orgCtx: ChecklistCopyContext = {
  accountKind: "organisation",
  organisationName: "Northbank Gallery",
  agreementHref: "#agreement",
};

function views(facts: Partial<ConsignmentChecklistFacts>, ctx = personalCtx) {
  const list = computeConsignmentChecklist({
    submissionStatus: "approved",
    accountKind: ctx.accountKind,
    identity: "required",
    agreement: { proposed: true, accepted: false },
    payoutsReady: false,
    viewer: { canAcceptAgreement: true, canSetUpPayouts: true },
    saleStartsAt: null,
    ...facts,
  });
  return list.items.map((item) => checklistItemView(item, ctx));
}

describe("checklistItemView", () => {
  it("says why, by when, and where to act when nothing is done", () => {
    const [identity, agreement, payouts] = views({});
    expect(identity).toMatchObject({
      title: "Verify your identity",
      due: "Needed before the specialist accepts the work",
      action: { label: "Verify", href: "/verify-identity" },
    });
    expect(agreement).toMatchObject({
      title: "Accept the consignment agreement",
      due: "Needed before the work is catalogued",
      action: { label: "Review", href: "#agreement" },
    });
    expect(payouts).toMatchObject({
      title: "Set up payouts",
      due: "Needed before the sale goes live",
      action: { label: "Set up", href: "/selling/payout-setup" },
    });
  });

  it("names the sale date once the lot is in a sale", () => {
    const payouts = views({ saleStartsAt: new Date("2026-11-04T18:00:00Z") })[2];
    expect(payouts?.due).toBe("Needed before the sale goes live on 4 Nov 2026");
  });

  it("ticks items off as done", () => {
    const all = views({
      identity: "verified",
      agreement: { proposed: true, accepted: true },
      payoutsReady: true,
    });
    expect(all.map((v) => [v.state, v.due, v.action])).toEqual([
      ["done", "Done", null],
      ["done", "Done", null],
      ["done", "Done", null],
    ]);
  });

  it("explains an agreement not proposed yet, without a button", () => {
    const agreement = views({ agreement: { proposed: false, accepted: false } })[1];
    expect(agreement?.state).toBe("not_yet");
    expect(agreement?.action).toBeNull();
    expect(agreement?.why).toMatch(/will send the estimate and terms/);
  });

  it("shows an organisation consignor who is waiting on others", () => {
    const [, agreement, payouts] = views(
      {
        identity: "verified",
        viewer: { canAcceptAgreement: false, canSetUpPayouts: false },
      },
      orgCtx,
    );
    expect(agreement?.waiting).toBe("An owner or admin of Northbank Gallery accepts this");
    expect(payouts?.waiting).toBe("Waiting for Northbank Gallery's payout setup");
    expect(payouts?.action).toBeNull();
  });

  it("sends organisation owners to the organisation's pages", () => {
    const [identity, , payouts] = views({}, orgCtx);
    expect(identity?.title).toBe("Verify Northbank Gallery");
    expect(identity?.action?.href).toBe("/organisation/documents");
    expect(payouts?.action?.href).toBe("/organisation/payouts");
  });
});

describe("checklist facts", () => {
  it("reads identity from the person's verification", () => {
    expect(personalIdentityFact({ status: "approved" })).toBe("verified");
    expect(personalIdentityFact({ status: "pending" })).toBe("checking");
    expect(personalIdentityFact({ status: "unverified" })).toBe("required");
    expect(personalIdentityFact(null)).toBe("required");
  });

  it("reads an organisation's identity from its review", () => {
    expect(organisationIdentityFact("approved")).toBe("verified");
    expect(organisationIdentityFact("under_review")).toBe("checking");
  });

  it("treats a proposal without an estimate and commission as not sent yet", () => {
    const facts = consignmentChecklistFacts({
      submission: { status: "approved" },
      agreement: {
        acceptedAt: null,
        estimateLow: null,
        estimateHigh: null,
        commissionPercent: null,
      },
      account: {
        accountKind: "personal",
        identity: "verified",
        payoutsReady: false,
        viewer: { canAcceptAgreement: true, canSetUpPayouts: true },
      },
      lot: null,
    });
    expect(facts.agreement).toEqual({ proposed: false, accepted: false });
    const [item] = computeConsignmentChecklist(facts).items.filter((i) => i.id === "agreement");
    const view = checklistItemView(item as NonNullable<typeof item>, personalCtx);
    expect(view.state).toBe("not_yet");
    expect(view.action).toBeNull();
    expect(view.why).toBe(
      "Your specialist will send the estimate and terms. You accept them here.",
    );
  });

  it("uses the sale start only once the lot is in a sale", () => {
    const account = {
      accountKind: "personal" as const,
      identity: "verified" as const,
      payoutsReady: true,
      viewer: { canAcceptAgreement: true, canSetUpPayouts: true },
    };
    const start = new Date("2026-11-04T18:00:00Z");
    expect(
      consignmentChecklistFacts({
        submission: { status: "converted" },
        agreement: {
          acceptedAt: new Date(),
          estimateLow: "8000",
          estimateHigh: "12000",
          commissionPercent: "15",
        },
        account,
        lot: { saleId: "sale-1", startTime: start },
      }).saleStartsAt,
    ).toEqual(start);
    expect(
      consignmentChecklistFacts({
        submission: { status: "converted" },
        agreement: null,
        account,
        lot: { saleId: null, startTime: start },
      }),
    ).toMatchObject({ saleStartsAt: null, agreement: { proposed: false, accepted: false } });
  });
});

describe("checklistItemView while the account holds accepting", () => {
  const facts = {
    identity: "verified",
    agreement: { proposed: true, accepted: false },
    payoutsReady: true,
  } as const;

  it("replaces the Review button with the reason", () => {
    const held = { ...orgCtx, agreementHeld: "Accepting is paused for Northbank Gallery." };
    const agreement = views(facts, held)[1];
    expect(agreement?.state).toBe("action");
    expect(agreement?.action).toBeNull();
    expect(agreement?.waiting).toBe("Accepting is paused for Northbank Gallery.");
  });

  it("keeps the button when nothing is held", () => {
    expect(views(facts, orgCtx)[1]?.action).toEqual({ label: "Review", href: "#agreement" });
  });
});
