import { describe, expect, it } from "vitest";
import { activeSectionId } from "./sale-anchor-active";

describe("activeSectionId", () => {
  it("marks the catalogue while it fills the view, even when Overview is close below", () => {
    expect(
      activeSectionId(
        [
          { id: "catalog", top: -400 },
          { id: "overview", top: 500 },
        ],
        200,
      ),
    ).toBe("catalog");
  });

  it("marks the first section before any reaches the reading line", () => {
    expect(
      activeSectionId(
        [
          { id: "catalog", top: 600 },
          { id: "overview", top: 2400 },
        ],
        200,
      ),
    ).toBe("catalog");
  });

  it("moves to Overview once its top passes the line, whatever the tab order", () => {
    expect(
      activeSectionId(
        [
          { id: "overview", top: 120 },
          { id: "catalog", top: -2000 },
        ],
        200,
      ),
    ).toBe("overview");
  });
});
