import { describe, expect, it } from "vitest";
import {
  type AuthorisationDraft,
  EMPTY_AUTHORISATION_DRAFT,
  draftFromAuthorisation,
  londonToday,
  parsePounds,
  toAuthoriseBuyerAgentInput,
  validateAuthorisationDraft,
} from "./authorisation-draft";

const draft = (over: Partial<AuthorisationDraft> = {}): AuthorisationDraft => ({
  ...EMPTY_AUTHORISATION_DRAFT,
  memberUserId: "agent-1",
  ...over,
});
const TODAY = "2026-10-27";

describe("parsePounds", () => {
  it.each([
    ["", null],
    ["10,000", 10000],
    ["£2,500.50", 2500.5],
    [" 75 ", 75],
  ])("reads %j as %s", (text, expected) => {
    expect(parsePounds(text)).toBe(expected);
  });

  it.each(["ten", "1.234", "-5"])("cannot read %j", (text) => {
    expect(parsePounds(text)).toBeNaN();
  });
});

describe("validateAuthorisationDraft", () => {
  it("accepts all sales with nothing else filled in", () => {
    expect(validateAuthorisationDraft(draft(), TODAY)).toEqual({});
  });

  it("asks for a member and, for one sale, the sale", () => {
    expect(validateAuthorisationDraft(draft({ memberUserId: "", scope: "sale" }), TODAY)).toEqual({
      memberUserId: "Choose who to authorise.",
      saleId: "Choose a sale.",
    });
  });

  it("explains an unreadable or zero limit", () => {
    expect(validateAuthorisationDraft(draft({ limit: "abc" }), TODAY).limit).toBe(
      "Enter an amount in pounds, like 10,000.",
    );
    expect(validateAuthorisationDraft(draft({ limit: "0" }), TODAY).limit).toBeDefined();
  });

  it("rejects an end in the past or before the start", () => {
    expect(validateAuthorisationDraft(draft({ endDay: "2026-10-01" }), TODAY).endDay).toBe(
      "The end date has already passed.",
    );
    expect(
      validateAuthorisationDraft(draft({ startDay: "2026-11-10", endDay: "2026-11-01" }), TODAY)
        .endDay,
    ).toBe("The end date must be on or after the start date.");
    expect(
      validateAuthorisationDraft(draft({ startDay: "2026-11-01", endDay: "2026-11-01" }), TODAY),
    ).toEqual({});
  });
});

describe("total limit", () => {
  it("is optional, read as pounds and never below the limit for one lot", () => {
    expect(validateAuthorisationDraft(draft({ totalLimit: "25,000" }), TODAY)).toEqual({});
    expect(validateAuthorisationDraft(draft({ totalLimit: "lots" }), TODAY)).toEqual({
      totalLimit: "Enter an amount in pounds, like 25,000.",
    });
    expect(
      validateAuthorisationDraft(draft({ limit: "10,000", totalLimit: "5,000" }), TODAY),
    ).toEqual({ totalLimit: "The total can't be less than the limit for one lot." });
  });
});

describe("toAuthoriseBuyerAgentInput", () => {
  it("sends whole London days and pounds", () => {
    expect(
      toAuthoriseBuyerAgentInput(
        draft({
          scope: "sale",
          saleId: "sale-1",
          limit: "10,000",
          totalLimit: "25,000",
          startDay: "2026-11-01",
          endDay: "2026-11-30",
        }),
      ),
    ).toEqual({
      memberUserId: "agent-1",
      saleId: "sale-1",
      bidLimit: 10000,
      totalLimit: 25000,
      validFrom: "2026-11-01T00:00:00.000Z",
      validUntil: "2026-11-30T23:59:00.000Z",
    });
  });

  it("starts a summer day at London midnight, an hour before UTC", () => {
    expect(toAuthoriseBuyerAgentInput(draft({ startDay: "2026-07-01" })).validFrom).toBe(
      "2026-06-30T23:00:00.000Z",
    );
  });

  it("drops the sale for all sales and leaves empty fields empty", () => {
    expect(toAuthoriseBuyerAgentInput(draft({ saleId: "sale-1" }))).toEqual({
      memberUserId: "agent-1",
      saleId: null,
      bidLimit: null,
      totalLimit: null,
      validFrom: null,
      validUntil: null,
    });
  });
});

describe("londonToday", () => {
  it("uses the London day, not UTC", () => {
    expect(londonToday(new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
  });
});

describe("draftFromAuthorisation", () => {
  it("fills the form from the authorisation in force, ready to save as a change", () => {
    expect(
      draftFromAuthorisation({
        userId: "agent-1",
        saleId: "sale-1",
        bidLimit: "6000.00",
        totalLimit: "20000.00",
        validFrom: "2026-10-01T00:00:00Z",
        validUntil: "2026-11-30T23:59:00Z",
        scheduled: false,
      }),
    ).toEqual({
      memberUserId: "agent-1",
      scope: "sale",
      saleId: "sale-1",
      limit: "6,000",
      totalLimit: "20,000",
      startDay: "",
      endDay: "2026-11-30",
    });
  });
});
