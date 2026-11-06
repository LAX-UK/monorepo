import { describe, expect, it } from "vitest";
import { manualRecord, ownRecord } from "./data-request.fixture";
import {
  ERASURE_ERROR_COPY,
  NO_EMAIL_REASON,
  enquiryErasureState,
  erasureErrorMessage,
  erasureOutcome,
  validateErasure,
} from "./enquiry-erasure";

const counts = { enquiries: 0, notes: 0, attachments: 0, held: 0 };

describe("enquiry erasure state", () => {
  it("is offered when the request has an email address", () => {
    expect(enquiryErasureState(manualRecord)).toEqual({ kind: "enabled" });
  });

  it("is disabled, with the reason, when there is no email address", () => {
    const record = { ...manualRecord, person: { ...manualRecord.person, email: null } };
    expect(enquiryErasureState(record)).toEqual({ kind: "disabled", reason: NO_EMAIL_REASON });
  });

  it("is hidden on a request about the signed-in person", () => {
    expect(enquiryErasureState(ownRecord)).toEqual({ kind: "hidden" });
  });
});

describe("enquiry erasure outcome", () => {
  it("counts the enquiries erased", () => {
    expect(erasureOutcome({ ...counts, enquiries: 3 })).toEqual({
      kind: "erased",
      message: "3 enquiries erased.",
      heldMessage: null,
    });
    expect(erasureOutcome({ ...counts, enquiries: 1 }).kind).toBe("erased");
  });

  it("says a held enquiry became a deal", () => {
    expect(erasureOutcome({ ...counts, enquiries: 2, held: 1 })).toMatchObject({
      kind: "erased",
      heldMessage: "1 enquiry became a deal, so it is kept until the deal closes.",
    });
    expect(erasureOutcome({ ...counts, held: 2 })).toEqual({
      kind: "held_only",
      message: "No enquiries were erased.",
      heldMessage: "2 enquiries became deals, so they are kept until the deals close.",
    });
  });

  it("says when there was nothing to erase", () => {
    expect(erasureOutcome(counts)).toEqual({
      kind: "none_found",
      message: "No enquiries were found for this email address.",
    });
  });
});

describe("enquiry erasure checks", () => {
  const email = "margaret.osei@outlook.co.uk";

  it("needs the address typed again, ignoring case and spaces", () => {
    expect(
      validateErasure(
        { confirmation: ` ${email.toUpperCase()} `, reason: "Asked to be forgotten" },
        email,
      ),
    ).toEqual({});
    expect(
      validateErasure({ confirmation: "other@x.com", reason: "Asked to be forgotten" }, email)
        .confirmation,
    ).toBe(ERASURE_ERROR_COPY.confirmation_mismatch);
  });

  it("needs a reason of 5 to 500 characters", () => {
    expect(validateErasure({ confirmation: email, reason: "no" }, email).reason).toBe(
      ERASURE_ERROR_COPY.reason_invalid,
    );
    expect(
      validateErasure({ confirmation: email, reason: "x".repeat(501) }, email).reason,
    ).toBeDefined();
  });

  it("words each refusal from the API", () => {
    expect(erasureErrorMessage("confirmation_mismatch", 422)).toBe(
      ERASURE_ERROR_COPY.confirmation_mismatch,
    );
    expect(erasureErrorMessage("reason_invalid", 422)).toBe(ERASURE_ERROR_COPY.reason_invalid);
    expect(erasureErrorMessage(undefined, 403)).toMatch(/permission/);
    expect(erasureErrorMessage(undefined, 503)).toMatch(/Nothing was changed/);
  });
});
