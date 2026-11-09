import { describe, expect, it } from "vitest";
import { COLLECT_COPY } from "./collect-copy";
import { type CollectFormState, validateCollectForm } from "./collect-form";

const base: CollectFormState = {
  lotIds: ["lot-1"],
  slotStart: "2026-11-12T14:00:00.000Z",
  collector: "self",
  name: "",
  email: "",
  company: "",
  authorised: false,
};

describe("validateCollectForm", () => {
  it("books me with my own name and no authorisation", () => {
    const result = validateCollectForm(base, "Ada Lovelace");
    expect(result).toEqual({
      ok: true,
      body: {
        lotIds: ["lot-1"],
        slotStart: base.slotStart,
        collector: { kind: "self", name: "Ada Lovelace" },
      },
    });
  });

  it("lists every problem in the order the page reads", () => {
    const result = validateCollectForm(
      { ...base, lotIds: [], slotStart: null, collector: "third_party" },
      "Ada",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.message)).toEqual([
      COLLECT_COPY.errors.lots,
      COLLECT_COPY.errors.time,
      COLLECT_COPY.errors.name,
      COLLECT_COPY.errors.authorisation,
    ]);
  });

  it("needs the authorisation tick for someone else", () => {
    const state = { ...base, collector: "third_party" as const, name: "Sam Shipper" };
    expect(validateCollectForm(state, "Ada").ok).toBe(false);
    const ok = validateCollectForm({ ...state, authorised: true, email: "sam@ship.co" }, "Ada");
    expect(ok).toMatchObject({
      ok: true,
      body: {
        collector: {
          kind: "third_party",
          name: "Sam Shipper",
          email: "sam@ship.co",
          authorised: true,
        },
      },
    });
  });

  it("rejects a badly formed collector email", () => {
    const result = validateCollectForm(
      { ...base, collector: "third_party", name: "Sam", authorised: true, email: "nope" },
      "Ada",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.message).toBe(COLLECT_COPY.errors.email);
  });
});
