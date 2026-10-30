import { describe, expect, it } from "vitest";
import {
  emailRegistrationRequestSchema,
  emailRegistrationResultSchema,
} from "./email-registration.js";

describe("email registration contract", () => {
  it("answers only yes or no", () => {
    expect(emailRegistrationResultSchema.safeParse({ registered: true }).success).toBe(true);
    expect(
      emailRegistrationResultSchema.safeParse({ registered: true, subjectId: "user_1" }).success,
    ).toBe(false);
  });

  it("requires an email", () => {
    expect(emailRegistrationRequestSchema.safeParse({ email: " " }).success).toBe(false);
    expect(emailRegistrationRequestSchema.safeParse({ email: "a@b.co" }).success).toBe(true);
  });
});
