import { describe, expect, it } from "vitest";
import { registerBodySchema } from "./register.js";
import { updateProfileSchema } from "./user.js";

describe("registerBodySchema phone", () => {
  it("normalizes structured phone to E.164", () => {
    const r = registerBodySchema.safeParse({
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      password: "SecurePass1!",
      persona: "individual",
      phone: { country: "GB", number: "7400123456" },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mobile).toBe("+447400123456");
      expect(r.data.mobileCountry).toBe("GB");
    }
  });

  it("omits phone when empty", () => {
    const r = registerBodySchema.safeParse({
      firstName: "A",
      lastName: "B",
      email: "a@b.com",
      password: "SecurePass1!",
      persona: "individual",
      phone: { country: "GB", number: "   " },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mobile).toBeUndefined();
    }
  });
});

describe("updateProfileSchema phone", () => {
  it("clears with phone null", () => {
    const r = updateProfileSchema.safeParse({ phone: null, mobile: null });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.mobile).toBeNull();
      expect(r.data.mobileCountry).toBeNull();
    }
  });
});
