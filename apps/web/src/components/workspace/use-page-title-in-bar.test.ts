import { describe, expect, it } from "vitest";
import { largeTitleScrolledAway } from "./use-page-title-in-bar";

function pageWithTitle(titleBottom: number, shown = true) {
  const main = document.createElement("main");
  const heading = document.createElement("h1");
  heading.dataset.pageTitle = "";
  heading.textContent = " Watching ";
  main.append(heading);
  main.getBoundingClientRect = () => ({ top: 52 }) as DOMRect;
  heading.getBoundingClientRect = () => ({ bottom: titleBottom }) as DOMRect;
  heading.getClientRects = () => (shown ? [{}] : []) as unknown as DOMRectList;
  return main;
}

describe("the phone bar's title", () => {
  it("stays out of the bar while the large title is on screen", () => {
    expect(largeTitleScrolledAway(pageWithTitle(120))).toBeNull();
  });

  it("moves into the bar once the large title has scrolled away", () => {
    expect(largeTitleScrolledAway(pageWithTitle(40))).toBe("Watching");
  });

  it("ignores a title the page hides, and a page without one", () => {
    expect(largeTitleScrolledAway(pageWithTitle(40, false))).toBeNull();
    expect(largeTitleScrolledAway(document.createElement("main"))).toBeNull();
  });
});
