import { describe, expect, it } from "vitest";
import { resolveActingBuyerLegalEntity } from "./resolve-acting-buyer-legal-entity.js";

describe("resolveActingBuyerLegalEntity", () => {
  it("prefers acting context over body", () => {
    const r = resolveActingBuyerLegalEntity({
      actingLegalEntityId: "a",
      bodyLegalEntityId: "a",
    });
    expect(r.isOk()).toBe(true);
    if (r.isOk()) expect(r.value).toBe("a");
  });

  it("rejects body mismatch", () => {
    const r = resolveActingBuyerLegalEntity({
      actingLegalEntityId: "a",
      bodyLegalEntityId: "b",
    });
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.code).toBe("legal_entity_mismatch");
  });

  it("requires entity when neither acting nor body", () => {
    const r = resolveActingBuyerLegalEntity({});
    expect(r.isErr()).toBe(true);
  });
});
