import type { CategoryNode } from "@auction/types";
import { describe, expect, it } from "vitest";
import { categoryPickerOptions } from "./category-picker-options";

function node(id: string, name: string, children: CategoryNode[] = []): CategoryNode {
  return { id, name, children } as unknown as CategoryNode;
}

describe("categoryPickerOptions", () => {
  it("lists parents before children and says where each child sits", () => {
    const options = categoryPickerOptions([
      node("prints", "Prints", [node("screen", "Screenprints", [node("pop", "Pop art")])]),
      node("paint", "Painting"),
    ]);
    expect(options).toEqual([
      { id: "prints", label: "Prints" },
      { id: "screen", label: "Screenprints", description: "Under Prints" },
      { id: "pop", label: "Pop art", description: "Under Prints › Screenprints" },
      { id: "paint", label: "Painting" },
    ]);
  });
});
