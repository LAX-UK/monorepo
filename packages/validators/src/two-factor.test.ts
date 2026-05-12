import { describe, expect, it } from "vitest";
import {
  backupCodeFormSchema,
  backupCodeValueSchema,
  totpCodeValueSchema,
  totpVerifyFormSchema,
} from "./two-factor.js";

describe("totpVerifyFormSchema", () => {
  it("accepts 6 digits", () => {
    expect(totpVerifyFormSchema.safeParse({ code: "123456" }).success).toBe(true);
  });
  it("rejects short codes", () => {
    expect(totpVerifyFormSchema.safeParse({ code: "12345" }).success).toBe(false);
  });
});

describe("totpCodeValueSchema", () => {
  it("rejects letters", () => {
    expect(totpCodeValueSchema.safeParse("12a456").success).toBe(false);
  });
});

describe("backupCodeFormSchema", () => {
  it("accepts alphanumeric", () => {
    expect(backupCodeFormSchema.safeParse({ code: "ABCD123456" }).success).toBe(true);
  });
  it("rejects too short", () => {
    expect(backupCodeFormSchema.safeParse({ code: "short" }).success).toBe(false);
  });
});

describe("backupCodeValueSchema", () => {
  it("rejects spaces in middle after trim", () => {
    expect(backupCodeValueSchema.safeParse("abcd efgh").success).toBe(false);
  });
});
