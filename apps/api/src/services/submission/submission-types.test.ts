import type { UpdateItemSubmissionInput } from "@auction/types";
import { describe, expect, it } from "vitest";
import { sellerPatchToRepoPatch } from "./submission-types.js";

describe("sellerPatchToRepoPatch", () => {
  it("categoryIds wins over categoryId when both present", () => {
    const patch = sellerPatchToRepoPatch({
      categoryIds: ["cat-1", "cat-2"],
      categoryId: "cat-ignored",
    });
    expect(patch.categoryIds).toEqual(["cat-1", "cat-2"]);
    expect(patch.categoryId).toBeUndefined();
  });

  it("maps categoryId when categoryIds absent", () => {
    const patch = sellerPatchToRepoPatch({ categoryId: "cat-1" });
    expect(patch.categoryId).toBe("cat-1");
    expect(patch.categoryIds).toBeUndefined();
  });

  it("coalesces nullable fields to null", () => {
    const patch = sellerPatchToRepoPatch({
      description: null,
      signatureNote: null,
    } as unknown as UpdateItemSubmissionInput);
    expect(patch.description).toBeNull();
    expect(patch.signatureNote).toBeNull();
  });
});
