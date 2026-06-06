import { describe, expect, it } from "vitest";
import {
  dedupePaletteSections,
  paletteItemCommandValue,
  paletteRecordHint,
} from "./palette-item-presenter";
import type { PaletteSection } from "./types";

describe("palette-item-presenter", () => {
  it("builds stable command values", () => {
    expect(
      paletteItemCommandValue({
        id: "a",
        href: "/admin",
        label: "Payments",
        hint: "Finance",
        keywords: "money",
      }),
    ).toBe("a Payments Finance money");
  });

  it("humanizes payment record hints", () => {
    expect(paletteRecordHint("record", "requires_manual_review")).toBe("Manual review");
  });

  it("dedupes sections by href keeping first occurrence", () => {
    const sections: PaletteSection[] = [
      {
        id: "suggested",
        heading: "Suggested",
        items: [{ id: "1", href: "/admin/payments", label: "Payments" }],
      },
      {
        id: "finance",
        heading: "Finance",
        items: [
          { id: "2", href: "/admin/payments", label: "Payments duplicate" },
          { id: "3", href: "/admin/payouts", label: "Payouts" },
        ],
      },
    ];

    const deduped = dedupePaletteSections(sections);
    expect(deduped).toHaveLength(2);
    expect(deduped[0]?.items).toHaveLength(1);
    expect(deduped[1]?.items).toHaveLength(1);
    expect(deduped[1]?.items[0]?.label).toBe("Payouts");
  });
});
