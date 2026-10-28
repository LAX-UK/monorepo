import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type UnsoldChoiceState,
  type UnsoldChoiceTransition,
  type UnsoldLotFacts,
  canChooseUnsoldOutcome,
  canTransitionUnsoldChoice,
  decideUnsoldChoiceConfirmation,
  decideUnsoldChoiceRequest,
  lotEndedUnsold,
  nextUnsoldChoiceStatus,
  relistReserveRefusal,
  unsoldChoiceAwaitingSeller,
} from "./unsold-lot-choice.js";

const unsold: UnsoldLotFacts = { status: "ended", winnerId: null, reservePrice: "5000.00" };

/** The whole transition table, so any change to a cell is a visible test change. */
const TABLE: Record<UnsoldChoiceTransition, Record<UnsoldChoiceState, boolean>> = {
  request: { none: true, requested: false, confirmed: false },
  change: { none: false, requested: true, confirmed: false },
  confirm: { none: false, requested: true, confirmed: false },
  adjust: { none: false, requested: true, confirmed: false },
  record: { none: true, requested: false, confirmed: false },
};

describe("unsold choice transitions", () => {
  for (const [transition, row] of Object.entries(TABLE) as [
    UnsoldChoiceTransition,
    Record<UnsoldChoiceState, boolean>,
  ][]) {
    for (const [from, allowed] of Object.entries(row) as [UnsoldChoiceState, boolean][]) {
      it(`${allowed ? "allows" : "refuses"} ${transition} from ${from}`, () => {
        expect(canTransitionUnsoldChoice(from, transition)).toBe(allowed);
      });
    }
  }

  it("moves a request to requested and a confirmation to confirmed", () => {
    expect(nextUnsoldChoiceStatus("none", "request")).toBe("requested");
    expect(nextUnsoldChoiceStatus("requested", "change")).toBe("requested");
    expect(nextUnsoldChoiceStatus("requested", "confirm")).toBe("confirmed");
    expect(nextUnsoldChoiceStatus("requested", "adjust")).toBe("confirmed");
    expect(nextUnsoldChoiceStatus("none", "record")).toBe("confirmed");
  });

  it("throws on a move the table does not allow", () => {
    expect(() => nextUnsoldChoiceStatus("confirmed", "change")).toThrow();
  });
});

describe("lotEndedUnsold", () => {
  it("is true for an ended or voided lot with no winner", () => {
    expect(lotEndedUnsold({ status: "ended", winnerId: null })).toBe(true);
    expect(lotEndedUnsold({ status: "voided", winnerId: null })).toBe(true);
  });

  it("is false for a sold lot or one still running", () => {
    expect(lotEndedUnsold({ status: "ended", winnerId: "buyer" })).toBe(false);
    expect(lotEndedUnsold({ status: "active", winnerId: null })).toBe(false);
    expect(lotEndedUnsold({ status: "scheduled", winnerId: null })).toBe(false);
  });

  it("waits on the seller only until someone chooses", () => {
    expect(unsoldChoiceAwaitingSeller(unsold, "none")).toBe(true);
    expect(unsoldChoiceAwaitingSeller(unsold, "requested")).toBe(false);
  });
});

describe("canChooseUnsoldOutcome", () => {
  it("lets a person choose for their own profile", () => {
    expect(canChooseUnsoldOutcome(null)).toBe(true);
  });

  it.each([
    ["owner", true],
    ["admin", true],
    ["finance", false],
    ["consignor", false],
    ["viewer", false],
    ["buyer_agent", false],
  ] as [LegalEntityMemberRole, boolean][])("an organisation %s may choose: %s", (role, can) => {
    expect(canChooseUnsoldOutcome({ role })).toBe(can);
  });

  it("never lets an impersonating admin choose", () => {
    expect(canChooseUnsoldOutcome({ role: "owner", isImpersonation: true })).toBe(false);
  });
});

describe("relistReserveRefusal", () => {
  it("accepts a lower reserve at or above the floor", () => {
    expect(relistReserveRefusal({ reserve: "4000", currentReserve: "5000", floor: "4000" })).toBe(
      null,
    );
  });

  it("refuses a reserve below the specialist's floor", () => {
    expect(
      relistReserveRefusal({ reserve: "3999.99", currentReserve: "5000", floor: "4000" }),
    ).toBe("reserve_below_floor");
  });

  it("refuses a reserve that is not lower than the current one", () => {
    expect(relistReserveRefusal({ reserve: "5000", currentReserve: "5000.00", floor: null })).toBe(
      "reserve_not_lower",
    );
    expect(relistReserveRefusal({ reserve: "6000", currentReserve: "5000", floor: null })).toBe(
      "reserve_not_lower",
    );
  });

  it("accepts any positive reserve when the lot had none and there is no floor", () => {
    expect(relistReserveRefusal({ reserve: "1200", currentReserve: null, floor: null })).toBe(null);
  });

  it.each(["0", "-5", "abc", "12.345", ""])("refuses %j as an amount", (reserve) => {
    expect(relistReserveRefusal({ reserve, currentReserve: "5000", floor: null })).toBe(
      "reserve_invalid",
    );
  });
});

describe("decideUnsoldChoiceRequest", () => {
  const base = {
    lot: unsold,
    current: "none" as UnsoldChoiceState,
    actor: null,
    choice: "relist" as const,
    reserve: null,
    floor: "3000.00",
  };

  it("records a first request", () => {
    expect(decideUnsoldChoiceRequest(base)).toEqual({
      kind: "record",
      transition: "request",
      status: "requested",
    });
  });

  it("lets the seller change a request before it is confirmed", () => {
    expect(decideUnsoldChoiceRequest({ ...base, current: "requested", choice: "collect" })).toEqual(
      { kind: "record", transition: "change", status: "requested" },
    );
  });

  it("refuses once a specialist confirmed", () => {
    const d = decideUnsoldChoiceRequest({ ...base, current: "confirmed" });
    expect(d).toMatchObject({ kind: "refused", reason: "already_confirmed" });
  });

  it("refuses for a lot that did not end unsold", () => {
    const d = decideUnsoldChoiceRequest({ ...base, lot: { ...unsold, winnerId: "buyer" } });
    expect(d).toMatchObject({ kind: "refused", reason: "not_unsold" });
  });

  it("refuses a consignor and says who can choose", () => {
    const d = decideUnsoldChoiceRequest({ ...base, actor: { role: "consignor" } });
    expect(d).toEqual({
      kind: "refused",
      reason: "forbidden_role",
      message: "Only an owner or admin can choose what happens next.",
    });
  });

  it("refuses a reserve for a private sale or collection", () => {
    const d = decideUnsoldChoiceRequest({ ...base, choice: "private_sale", reserve: "4000" });
    expect(d).toMatchObject({ kind: "refused", reason: "reserve_only_for_relist" });
  });

  it("refuses a relist reserve below the floor", () => {
    const d = decideUnsoldChoiceRequest({ ...base, reserve: "2500" });
    expect(d).toMatchObject({ kind: "refused", reason: "reserve_below_floor" });
  });
});

describe("decideUnsoldChoiceConfirmation", () => {
  const requested = {
    lot: unsold,
    current: "requested" as UnsoldChoiceState,
    requested: { choice: "relist" as const, reserve: "4000.00" },
  };

  it("confirms a request exactly as asked", () => {
    expect(
      decideUnsoldChoiceConfirmation({ ...requested, choice: "relist", reserve: "4000" }),
    ).toMatchObject({ kind: "record", transition: "confirm", status: "confirmed" });
  });

  it("adjusts when the specialist changes the reserve or the outcome, with a note", () => {
    const note = "The market is quiet; a private buyer is interested.";
    expect(
      decideUnsoldChoiceConfirmation({ ...requested, choice: "relist", reserve: "4200", note }),
    ).toMatchObject({ transition: "adjust" });
    expect(
      decideUnsoldChoiceConfirmation({ ...requested, choice: "private_sale", reserve: null, note }),
    ).toMatchObject({ transition: "adjust" });
  });

  it("asks for a note before adjusting what the seller asked", () => {
    expect(
      decideUnsoldChoiceConfirmation({ ...requested, choice: "collect", reserve: null, note: " " }),
    ).toMatchObject({ kind: "refused", reason: "note_required" });
  });

  it("records an outcome for a seller who told the specialist directly", () => {
    expect(
      decideUnsoldChoiceConfirmation({
        lot: unsold,
        current: "none",
        requested: null,
        choice: "collect",
        reserve: null,
      }),
    ).toMatchObject({ transition: "record", status: "confirmed" });
  });

  it("is not held to the floor but still needs a real amount", () => {
    expect(
      decideUnsoldChoiceConfirmation({
        ...requested,
        choice: "relist",
        reserve: "100",
        note: "Agreed by phone.",
      }),
    ).toMatchObject({ kind: "record" });
    expect(
      decideUnsoldChoiceConfirmation({ ...requested, choice: "relist", reserve: "0" }),
    ).toMatchObject({ kind: "refused", reason: "reserve_invalid" });
  });

  it("refuses a second confirmation", () => {
    expect(
      decideUnsoldChoiceConfirmation({
        ...requested,
        current: "confirmed",
        choice: "collect",
        reserve: null,
      }),
    ).toMatchObject({ kind: "refused", reason: "already_confirmed" });
  });
});
