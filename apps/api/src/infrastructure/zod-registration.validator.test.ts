import { describe, expect, it } from "vitest";
import { ZodRegistrationValidator } from "./zod-registration.validator.js";

const baseValid = {
  firstName: "Alice",
  lastName: "Test",
  email: "alice@example.com",
  password: "correct horse battery staple",
};

describe("ZodRegistrationValidator (SE-P24 persona enforcement)", () => {
  const v = new ZodRegistrationValidator();

  it("accepts persona='individual'", () => {
    const result = v.validate({ ...baseValid, persona: "individual" });
    expect(result).toEqual({ ok: true });
  });

  it("accepts persona='organisation'", () => {
    const result = v.validate({ ...baseValid, persona: "organisation" });
    expect(result).toEqual({ ok: true });
  });

  it("rejects payloads with no persona field", () => {
    // biome-ignore lint/suspicious/noExplicitAny: deliberately omitting persona to test schema rejection
    const result = v.validate({ ...baseValid } as any);
    expect(result.ok).toBe(false);
  });

  it("rejects unknown persona values", () => {
    // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid value to test enum rejection
    const result = v.validate({ ...baseValid, persona: "buyer-only" } as any);
    expect(result.ok).toBe(false);
  });
});
