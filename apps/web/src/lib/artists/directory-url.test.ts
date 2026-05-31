import { artistDirectoryWithQuery } from "@/lib/artists/directory-url";
import { describe, expect, it } from "vitest";

describe("artistDirectoryWithQuery", () => {
  it("clears offset by default for filter changes", () => {
    expect(
      artistDirectoryWithQuery("/artists", { offset: "48", q: "banksy" }, { category: "prints" }),
    ).toBe("/artists?q=banksy&category=prints");
  });

  it("preserves patched offset for pagination links", () => {
    expect(
      artistDirectoryWithQuery(
        "/artists",
        { q: "banksy" },
        { offset: 48, view: "grid" },
        { preserveOffset: true },
      ),
    ).toBe("/artists?q=banksy&offset=48&view=grid");
  });
});
