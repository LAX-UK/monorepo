import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorCopy, publicFormErrorMap } from "./error-copy";
import { summaryItems } from "./use-form-error-summary";

function firstMessage(schema: z.ZodTypeAny, value: unknown): string | undefined {
  const result = schema.safeParse(value, { errorMap: publicFormErrorMap });
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe("public form error copy", () => {
  it("phrases the design's rules as sentences", () => {
    expect(errorCopy.required("your first name")).toBe("Enter your first name");
    expect(errorCopy.requiredChoice("a topic")).toBe("Choose a topic");
    expect(errorCopy.minLength(10, "Tell us a little more")).toBe(
      "Tell us a little more: at least 10 characters",
    );
    expect(errorCopy.maxLength(2000, "your message")).toBe(
      "Keep your message under 2,000 characters",
    );
  });

  it("replaces the validator's wording by default", () => {
    expect(firstMessage(z.string().email(), "nope")).toBe(errorCopy.email);
    expect(firstMessage(z.string().min(10), "short")).toBe(errorCopy.minLength(10));
    expect(firstMessage(z.string().max(5), "far too long")).toBe(errorCopy.maxLength(5));
    expect(firstMessage(z.enum(["a", "b"]), "c")).toBe(errorCopy.invalidChoice);
    expect(firstMessage(z.string(), undefined)).toBe(errorCopy.required("a value"));
  });

  it("keeps a message the schema states itself", () => {
    const schema = z.string().min(1, errorCopy.required("your email address"));
    expect(firstMessage(schema, "")).toBe("Enter your email address");
  });
});

describe("summaryItems", () => {
  it("lists invalid fields in page order and skips those without an error", () => {
    const errors = {
      message: { type: "x", message: "Enter your message" },
      email: { type: "x", message: "Enter your email address" },
    };
    expect(
      summaryItems(errors, { firstName: "first", email: "email", message: "message" }),
    ).toEqual([
      { fieldId: "email", message: "Enter your email address" },
      { fieldId: "message", message: "Enter your message" },
    ]);
  });
});
