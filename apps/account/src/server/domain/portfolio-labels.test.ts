import {
  LAX_MONEY_STATUSES,
  LAX_PORTFOLIO_ITEM_STATUSES,
  MONEY_SECTION_KEYS,
} from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import {
  MONEY_STATUS_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  type StatusStyle,
  moneyStatusStyle,
} from "./portfolio-labels";

const NEEDS_YOU: StatusStyle = { tone: "warning", cue: "alert" };
const IN_PROGRESS: StatusStyle = { tone: "info", cue: "dot" };
const SETTLED: StatusStyle = { tone: "neutral", cue: "check" };
const CLOSED: StatusStyle = { tone: "neutral", cue: "ring" };

describe("STATUS_STYLES", () => {
  it("marks only the work that needs the person as warning", () => {
    const warning = LAX_PORTFOLIO_ITEM_STATUSES.filter(
      (status) => STATUS_STYLES[status].tone === "warning",
    );
    expect(warning).toEqual(["awaiting_payment"]);
    expect(STATUS_STYLES.awaiting_payment).toEqual(NEEDS_YOU);
  });

  it("shows work in progress as info with the dot", () => {
    for (const status of [
      "awaiting_shipment",
      "consigned",
      "in_sale",
      "payout_pending",
      "payment_confirming",
    ] as const) {
      expect(STATUS_STYLES[status], status).toEqual(IN_PROGRESS);
    }
  });

  it("shows settled work as neutral with the check", () => {
    for (const status of ["owned", "sold", "payout_paid"] as const) {
      expect(STATUS_STYLES[status], status).toEqual(SETTLED);
    }
  });

  it("only uses the neutral, info and warning tones, and every status has a label", () => {
    for (const status of LAX_PORTFOLIO_ITEM_STATUSES) {
      expect(["neutral", "info", "warning"]).toContain(STATUS_STYLES[status].tone);
      expect(STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("moneyStatusStyle", () => {
  it("marks a pending line you owe as needing you", () => {
    expect(moneyStatusStyle("pending", "owed_by_you")).toEqual(NEEDS_YOU);
  });

  it("shows any other pending line as in progress", () => {
    for (const section of MONEY_SECTION_KEYS.filter((key) => key !== "owed_by_you")) {
      expect(moneyStatusStyle("pending", section), section).toEqual(IN_PROGRESS);
    }
  });

  it("shows completed lines as settled and cancelled lines as closed, in every section", () => {
    for (const section of MONEY_SECTION_KEYS) {
      expect(moneyStatusStyle("completed", section), section).toEqual(SETTLED);
      expect(moneyStatusStyle("cancelled", section), section).toEqual(CLOSED);
    }
  });

  it("gives Pending and Completed different looks, and never danger or success", () => {
    for (const status of LAX_MONEY_STATUSES) {
      for (const section of MONEY_SECTION_KEYS) {
        expect(["neutral", "info", "warning"]).toContain(moneyStatusStyle(status, section).tone);
      }
      expect(MONEY_STATUS_LABELS[status]).toBeTruthy();
    }
    expect(moneyStatusStyle("pending", "paid")).not.toEqual(moneyStatusStyle("completed", "paid"));
  });
});
