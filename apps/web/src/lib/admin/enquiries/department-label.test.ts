import { DEPARTMENTS } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { departmentLabel, departmentNames } from "./department-label";

describe("departmentLabel", () => {
  it.each(DEPARTMENTS.map((department) => [department.slug, department.label]))(
    "names %s as staff read it",
    (slug, label) => {
      expect(departmentLabel(slug)).toBe(label);
    },
  );

  it("keeps the ampersand rather than turning the slug into words", () => {
    expect(departmentLabel("watches-clocks")).toBe("Watches & clocks");
    expect(departmentLabel("watches-clocks")).not.toBe("Watches clocks");
  });

  it("still reads a slug it does not know", () => {
    expect(departmentLabel("tribal-art")).toBe("Tribal art");
  });
});

describe("departmentNames", () => {
  it("names each slug once and skips empty ones", () => {
    expect(departmentNames(["paintings", null, undefined, "paintings"])).toEqual({
      paintings: "Paintings",
    });
  });
});
