import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";
import {
  REOFFER_INVOICE_DUE_DAYS,
  offerClosedCopy,
  offerMadeCopy,
  reofferDeadlineText,
  sellerOutcomeCopy,
} from "./reoffer-copy.js";

const base = {
  userName: "Maya",
  lotTitle: "Harbour at dusk",
  price: "£1,000.00",
  supportContactEmail: "support@lax.bid",
};
const WORKSPACE = "https://lax.bid/workspace/buying/offers/r1";
/** 17:00 London on 15 November 2026 (GMT). */
const ENDS = "2026-11-15T17:00:00.000Z";

describe("re-offer copy", () => {
  it("states deadlines at London time, across the clock change", () => {
    expect(reofferDeadlineText(ENDS)).toBe("17:00 on 15 November 2026");
    expect(reofferDeadlineText("2026-07-15T16:00:00.000Z")).toBe("17:00 on 15 July 2026");
  });

  it("uses the same words in the app as in the email", async () => {
    const copy = offerMadeCopy({ ...base, windowEndsAt: ENDS });
    const email = await renderEmail("reoffer-offer-made", {
      ...base,
      windowEndsAt: ENDS,
      workspaceUrl: WORKSPACE,
    });
    expect(email.subject).toBe(copy.title);
    expect(email.text).toContain(copy.paragraphs[0]);
  });
});

describe("reoffer-seller-consent-request", () => {
  it("asks for agreement by the deadline and names no bidder", async () => {
    const email = await renderEmail("reoffer-seller-consent-request", {
      ...base,
      answerBy: ENDS,
      actionUrl: "https://lax.bid/organisations/o1/reoffers/r1",
    });
    expect(email.subject).toBe("Can we sell Harbour at dusk to the next bidder?");
    expect(email.text).toContain("17:00 on 15 November 2026");
    expect(email.text).toContain("The bidder is not named to you");
    expect(email.text).toContain("London Auction Xchange");
  });
});

describe("reoffer-offer-made", () => {
  it("states price, window and binding terms, and links to the workspace only", async () => {
    const email = await renderEmail("reoffer-offer-made", {
      ...base,
      windowEndsAt: ENDS,
      workspaceUrl: WORKSPACE,
    });
    expect(email.subject).toBe("An offer to buy Harbour at dusk at £1,000.00");
    expect(email.text).toContain("17:00 on 15 November 2026");
    expect(email.text).toContain("Accepting is binding");
    expect(email.text).toContain("never a hidden maximum");
    expect(email.text).toContain(`${REOFFER_INVOICE_DUE_DAYS} days after you accept`);
    expect(email.html).toContain(WORKSPACE);
    expect(email.html).not.toMatch(/accept=|\/accept/);
    expect(email.text).toContain("London Auction Xchange");
  });
});

describe("reoffer-offer-reminder", () => {
  it("reminds the bidder when the offer ends", async () => {
    const email = await renderEmail("reoffer-offer-reminder", {
      ...base,
      windowEndsAt: ENDS,
      workspaceUrl: WORKSPACE,
    });
    expect(email.subject).toBe("Your offer for Harbour at dusk ends soon");
    expect(email.text).toContain("ends at 17:00 on 15 November 2026");
    expect(email.text).toContain("the offer lapses and you owe nothing");
  });
});

describe("reoffer-offer-accepted", () => {
  it("says the invoice is due in seven days", async () => {
    const email = await renderEmail("reoffer-offer-accepted", {
      ...base,
      invoiceDueAt: "2026-11-22T23:59:59.000Z",
      workspaceUrl: WORKSPACE,
    });
    expect(email.subject).toBe("You have bought Harbour at dusk");
    expect(email.text).toContain("due by 22 November 2026, 7 days after you accepted");
  });
});

describe("reoffer-offer-closed", () => {
  it.each([
    ["declined", "You declined the offer for Harbour at dusk"],
    ["expired", "The offer for Harbour at dusk has ended"],
    ["withdrawn", "The offer for Harbour at dusk was withdrawn"],
  ] as const)("tells the bidder when it was %s", async (outcome, subject) => {
    const email = await renderEmail("reoffer-offer-closed", {
      ...base,
      outcome,
      workspaceUrl: WORKSPACE,
    });
    expect(email.subject).toBe(subject);
    expect(email.text).toContain("You do not owe anything");
    expect(offerClosedCopy({ lotTitle: base.lotTitle, outcome }).title).toBe(subject);
  });
});

describe("reoffer-seller-outcome", () => {
  it.each(["accepted", "not_accepted"] as const)(
    "tells the seller the outcome (%s) without naming the bidder",
    async (outcome) => {
      const email = await renderEmail("reoffer-seller-outcome", {
        ...base,
        outcome,
        actionUrl: "https://lax.bid/organisations/o1/lots/l1",
      });
      expect(email.subject).toBe(sellerOutcomeCopy({ ...base, outcome }).title);
      expect(email.text).toContain("£1,000.00");
      expect(email.text).not.toMatch(/bidder (named|called)|Bidder\s/);
    },
  );
});

describe("reoffer-staff-notice", () => {
  it.each([
    ["accepted", "Re-offer accepted: Harbour at dusk", "Jo Bidder accepted the re-offer"],
    ["declined", "Re-offer declined: Harbour at dusk", "Jo Bidder declined the re-offer"],
    ["expired", "Re-offer expired: Harbour at dusk", "Jo Bidder let lapse the re-offer"],
    ["withdrawn", "Re-offer withdrawn: Harbour at dusk", "had their offer withdrawn"],
  ] as const)(
    "tells staff the offer was %s and names the bidder",
    async (outcome, subject, line) => {
      const email = await renderEmail("reoffer-staff-notice", {
        lotTitle: base.lotTitle,
        lotReference: "LOT-7",
        price: base.price,
        bidderName: "Jo Bidder",
        outcome,
        adminUrl: "https://admin.lax.bid/lots/l1",
        supportContactEmail: base.supportContactEmail,
      });
      expect(email.subject).toBe(subject);
      expect(email.text).toContain(line);
      expect(email.text).toContain("LOT-7");
    },
  );
});
