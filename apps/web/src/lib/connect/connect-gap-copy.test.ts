import { describe, expect, it } from "vitest";
import {
  connectGapActionHint,
  connectGapMissingCountLabel,
  connectGapPayoutsBannerCopy,
  connectGapReadOnlySummary,
  connectGapStageSummary,
} from "./connect-gap-copy";

describe("connectGapStageSummary", () => {
  it("uses actionable copy for requirements_due", () => {
    expect(connectGapStageSummary("requirements_due")).toContain("Complete the form below");
  });

  it("does not expose raw Stripe codes for restricted", () => {
    expect(connectGapStageSummary("restricted")).toContain("support@lax.bid");
    expect(connectGapStageSummary("restricted")).not.toContain("requirements.past_due");
  });
});

describe("connectGapActionHint", () => {
  it("returns form hint for in-progress stages", () => {
    expect(connectGapActionHint("requirements_due")).toContain("secure form below");
  });

  it("returns null for read-only viewers", () => {
    expect(connectGapActionHint("requirements_due", { readOnly: true })).toBeNull();
  });

  it("returns null for ready", () => {
    expect(connectGapActionHint("ready")).toBeNull();
  });
});

describe("connectGapReadOnlySummary", () => {
  it("does not reference the embedded form", () => {
    expect(connectGapReadOnlySummary("requirements_due")).toContain("owner or admin");
    expect(connectGapReadOnlySummary("requirements_due")).not.toContain("form below");
  });
});

describe("connectGapStageSummary", () => {
  it("uses read-only copy when requested", () => {
    expect(connectGapStageSummary("requirements_due", undefined, { readOnly: true })).toContain(
      "owner or admin",
    );
  });
});

describe("connectGapPayoutsBannerCopy", () => {
  it("differentiates not started from action required", () => {
    expect(
      connectGapPayoutsBannerCopy({
        stage: "not_started",
        missing: [],
        canReceivePayouts: false,
        canPublish: false,
      }).title,
    ).toBe("Start payout setup");
    expect(
      connectGapPayoutsBannerCopy({
        stage: "requirements_due",
        missing: [],
        canReceivePayouts: false,
        canPublish: false,
      }).title,
    ).toBe("Action required on payout setup");
  });

  it("uses overdue copy when disabledReason is requirements.past_due", () => {
    expect(
      connectGapPayoutsBannerCopy({
        stage: "requirements_due",
        missing: [],
        canReceivePayouts: false,
        canPublish: false,
        disabledReason: "requirements.past_due",
      }).title,
    ).toBe("Finish overdue payout details");
  });

  it("uses support copy for restricted accounts", () => {
    const copy = connectGapPayoutsBannerCopy({
      stage: "restricted",
      missing: [],
      canReceivePayouts: false,
      canPublish: false,
    });
    expect(copy.title).toBe("Payout account restricted");
    expect(copy.description).toContain("support@lax.bid");
  });
});

describe("connectGapMissingCountLabel", () => {
  it("counts actionable items excluding stripe_disabled summary", () => {
    const label = connectGapMissingCountLabel({
      stage: "requirements_due",
      missing: [
        {
          key: "stripe_disabled",
          label: "Overdue payout details",
          hint: "Complete the form",
          severity: "warning",
        },
        {
          key: "external_account",
          label: "Bank account",
          hint: "Add a UK bank account",
          severity: "warning",
        },
      ],
      canReceivePayouts: false,
      canPublish: false,
    });
    expect(label).toBe("1 detail needed");
  });
});
