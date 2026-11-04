import { describe, expect, it } from "vitest";
import {
  emptyLogRequest,
  extensionChoices,
  isLogRequestDirty,
  oldReceivedWarning,
  previewDueOn,
  validateClose,
  validateExtend,
  validateIdReceived,
  validateLogRequest,
} from "./data-request-forms";

const TODAY = "2026-11-02";
const ACCOUNT = { subjectId: "u1", name: "Margaret Osei", status: "active" };

describe("log a manual request", () => {
  it("is valid for a found account with the defaults", () => {
    expect(validateLogRequest({ ...emptyLogRequest(TODAY), account: ACCOUNT }, TODAY)).toEqual({});
  });

  it("asks for the person, the date and a note for Other, all at once", () => {
    const errors = validateLogRequest(
      { ...emptyLogRequest(TODAY), reason: "other", receivedOn: "2026-11-12" },
      TODAY,
    );
    expect(errors).toEqual({
      person: 'Choose the person\'s LAX account, or switch to "No account".',
      receivedOn: "Received date can't be in the future.",
      notes: 'Add a note for "Other".',
    });
  });

  it("asks for a name and contact when there is no account", () => {
    const errors = validateLogRequest(
      { ...emptyLogRequest(TODAY), personMode: "contact", contactName: " ", contactDetail: "" },
      TODAY,
    );
    expect(Object.keys(errors)).toEqual(["contactName", "contactDetail"]);
  });

  it("needs a product, a real date and a note under the limit", () => {
    const draft = { ...emptyLogRequest(TODAY), account: ACCOUNT };
    expect(validateLogRequest({ ...draft, products: [] }, TODAY).products).toBeDefined();
    expect(validateLogRequest({ ...draft, receivedOn: null }, TODAY).receivedOn).toBeDefined();
    expect(validateLogRequest({ ...draft, notes: "x".repeat(2001) }, TODAY).notes).toBeDefined();
  });

  it("previews the ICO month rule, ending on the last day of a shorter month", () => {
    expect(previewDueOn({ receivedOn: "2026-11-02", identity: "confirmed" })).toBe("2026-12-02");
    expect(previewDueOn({ receivedOn: "2026-01-31", identity: "confirmed" })).toBe("2026-02-28");
    expect(previewDueOn({ receivedOn: "2026-11-02", identity: "asked_for_proof" })).toBeNull();
    expect(previewDueOn({ receivedOn: null, identity: "confirmed" })).toBeNull();
  });

  it("warns, but does not refuse, a request that reached us over a month ago", () => {
    expect(oldReceivedWarning("2026-09-01", TODAY)).toMatch(/more than a month ago/);
    expect(oldReceivedWarning("2026-10-20", TODAY)).toBeNull();
    expect(oldReceivedWarning("2026-11-20", TODAY)).toBeNull();
  });

  it("is dirty only once something differs from a fresh form", () => {
    const fresh = emptyLogRequest(TODAY);
    expect(isLogRequestDirty(fresh, TODAY)).toBe(false);
    expect(isLogRequestDirty({ ...fresh, notes: "x" }, TODAY)).toBe(true);
    expect(isLogRequestDirty({ ...fresh, products: ["bid"] }, TODAY)).toBe(true);
  });
});

describe("extend", () => {
  const limits = { originalDueOn: "2026-11-09", today: TODAY };
  const good = {
    months: 2 as const,
    reason: "complex" as const,
    note: "Twelve years of correspondence.",
    personToldOn: "2026-11-02",
    personToldVia: "post" as const,
  };

  it("accepts a reason, a note and when and how the person was told", () => {
    expect(validateExtend(good, limits)).toEqual({});
  });

  it("requires the person to be told on or before the original due date, and not in the future", () => {
    expect(
      validateExtend(
        { ...good, personToldOn: "2026-11-10" },
        { originalDueOn: "2026-11-09", today: "2026-11-12" },
      ).personToldOn,
    ).toMatch(/original due date/);
    expect(validateExtend({ ...good, personToldOn: "2026-11-03" }, limits).personToldOn).toMatch(
      /future/,
    );
  });

  it("requires a note and a way of telling", () => {
    const errors = validateExtend({ ...good, note: " ", personToldVia: null }, limits);
    expect(Object.keys(errors).sort()).toEqual(["note", "personToldVia"]);
  });

  it("offers one and two months from the original due date", () => {
    expect(extensionChoices("2026-10-18")).toEqual({ 1: "2026-11-18", 2: "2026-12-18" });
    expect(extensionChoices("2026-12-31")[2]).toBe("2027-02-28");
  });
});

describe("close", () => {
  it("needs an outcome", () => {
    expect(validateClose({ outcome: null, note: "", complaintRightTold: false })).toEqual({
      outcome: "Choose an outcome.",
    });
  });

  it("needs no note for a plain copy", () => {
    expect(validateClose({ outcome: "sent", note: "", complaintRightTold: false })).toEqual({});
  });

  it("makes a partial copy name the exemption", () => {
    expect(
      validateClose({ outcome: "sent_partial", note: "", complaintRightTold: false }).note,
    ).toBe("Name the exemption that applies.");
  });

  it("makes a refusal give its reason and confirm the person was told of the ICO", () => {
    const errors = validateClose({ outcome: "refused", note: "", complaintRightTold: false });
    expect(errors.note).toMatch(/manifestly unfounded/);
    expect(errors.complaintRightTold).toMatch(/told before closing/);
    expect(
      validateClose({ outcome: "refused", note: "Repeated 14 times", complaintRightTold: true }),
    ).toEqual({});
  });
});

describe("ID received", () => {
  const limits = { requestReceivedOn: "2026-10-30", today: TODAY };

  it("accepts any day from the request to today", () => {
    expect(validateIdReceived("2026-11-01", limits)).toBeNull();
    expect(validateIdReceived("2026-10-30", limits)).toBeNull();
  });

  it("refuses a missing day, a future day, or a day before the request", () => {
    expect(validateIdReceived(null, limits)).toMatch(/Enter/);
    expect(validateIdReceived("2026-11-03", limits)).toMatch(/future/);
    expect(validateIdReceived("2026-10-29", limits)).toMatch(/before the request/);
  });
});
