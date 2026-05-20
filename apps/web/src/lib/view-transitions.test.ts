import { lotImageTransitionName } from "@/lib/view-transitions";
import { describe, expect, it } from "vitest";

describe("lotImageTransitionName", () => {
  it("sanitizes unsafe characters in lot ids", () => {
    expect(lotImageTransitionName("b1000016-0000-4000-8000-000000000016")).toBe(
      "lot-image-b1000016-0000-4000-8000-000000000016",
    );
    expect(lotImageTransitionName("weird/id+here")).toBe("lot-image-weird_id_here");
  });
});
