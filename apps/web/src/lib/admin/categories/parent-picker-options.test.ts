import type { Category } from "@auction/types";
import { describe, expect, it } from "vitest";
import { NO_PARENT_ID, parentPickerOptions } from "./parent-picker-options";

function category(
  id: string,
  name: string,
  parentId: string | null,
  extra: Partial<Category> = {},
) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    parentId,
    sortOrder: 0,
    archived: false,
    description: null,
    heroImageKey: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...extra,
  } satisfies Category;
}

const tree = [
  category("prints", "Prints", null),
  category("etchings", "Etchings", "prints"),
  category("proofs", "Proofs", "etchings"),
  category("books", "Books", null, { sortOrder: 1 }),
  category("old", "Old books", "books", { archived: true }),
];

describe("parentPickerOptions", () => {
  it("starts with top level, then follows the tree and says where nested ones sit", () => {
    expect(parentPickerOptions(tree).map((o) => [o.id, o.label, o.description])).toEqual([
      [NO_PARENT_ID, "No parent", "A top-level category"],
      ["prints", "Prints", undefined],
      ["etchings", "Etchings", "Under Prints"],
      ["proofs", "Proofs", "Under Prints › Etchings"],
      ["books", "Books", undefined],
    ]);
  });

  it("leaves out the category itself, everything under it and archived categories", () => {
    const ids = parentPickerOptions(tree, "etchings").map((o) => o.id);
    expect(ids).toEqual([NO_PARENT_ID, "prints", "books"]);
  });
});
