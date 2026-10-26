import { STAFF_PARSE_PARAMS } from "@/lib/forms/staff-error-map";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const schema = z.object({
  website: z.string().url(),
  name: z.string().min(1),
  note: z.string().max(5),
  code: z.string().min(3),
  own: z.string().min(1, "Name the record"),
  required: z.string(),
  count: z.coerce.number().optional(),
});

function messages(input: unknown): Record<string, string> {
  const result = schema.safeParse(input, STAFF_PARSE_PARAMS);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("staffErrorMap", () => {
  it("says how to fix a field in plain words", () => {
    const found = messages({ website: "nope", name: "", note: "too long", code: "ab", own: "" });
    expect(found.website).toBe("Enter a full web address, starting with https://");
    expect(found.name).toBe("Enter a value");
    expect(found.note).toBe("Use 5 characters or fewer");
    expect(found.code).toBe("Use at least 3 characters");
    expect(found.required).toBe("Enter a value");
    expect(messages({ count: "abc" }).count).toBe("Enter a number");
  });

  it("leaves a message the schema wrote itself alone", () => {
    expect(messages({ own: "" }).own).toBe("Name the record");
  });
});
