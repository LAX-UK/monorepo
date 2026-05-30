import { describe, expect, it } from "vitest";
import { CONDITION_REPORT_REQUEST_NOTE_MAX, conditionReportRequestFormSchema } from "./lot.js";

describe("conditionReportRequestFormSchema", () => {
  it("accepts empty note", () => {
    const r = conditionReportRequestFormSchema.safeParse({ requestNote: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.requestNote).toBe("");
  });

  it("trims whitespace", () => {
    const r = conditionReportRequestFormSchema.safeParse({ requestNote: "  hello  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.requestNote).toBe("hello");
  });

  it("rejects note over max length", () => {
    const r = conditionReportRequestFormSchema.safeParse({
      requestNote: "x".repeat(CONDITION_REPORT_REQUEST_NOTE_MAX + 1),
    });
    expect(r.success).toBe(false);
  });
});
