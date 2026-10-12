import { describe, expect, it } from "vitest";
import { moveItem, removeItem, replaceItem } from "./editorial-list-ops";

describe("moveItem", () => {
  it("moves an item up and down", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("leaves the list unchanged at the edges", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
    expect(moveItem(["a", "b"], 5, -1)).toEqual(["a", "b"]);
  });

  it("does not mutate the input", () => {
    const input = ["a", "b"];
    moveItem(input, 0, 1);
    expect(input).toEqual(["a", "b"]);
  });
});

describe("removeItem / replaceItem", () => {
  it("removes by index", () => {
    expect(removeItem(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });

  it("replaces by index", () => {
    expect(replaceItem(["a", "b"], 1, "z")).toEqual(["a", "z"]);
  });
});
