import { describe, expect, it } from "vitest";
import { catalogueControls } from "./catalogue-controls";

describe("catalogueControls", () => {
  it.each([
    [0, false, false],
    [6, false, false],
    [11, false, false],
    [12, true, false],
    [39, true, false],
    [40, true, true],
    [200, true, true],
  ])("a sale of %i lots: toolbar %s, search %s", (count, toolbar, search) => {
    expect(catalogueControls(count)).toEqual({ toolbar, search });
  });
});
