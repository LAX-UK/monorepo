import { describe, expect, it } from "vitest";
import {
  REQUIRED_PRERENDERED_ROUTES,
  findPrerenderProblems,
  prerenderedFileBase,
  prerenderedRoutes,
} from "../../../scripts/prerendered-output.mjs";
import { ART_PRERENDERED_ROUTES } from "./prerendered-routes";

const ISR = { initialRevalidateSeconds: 120 };

describe("the prerendered routes the build is checked for", () => {
  it("are exactly the copies middleware serves documents from", () => {
    expect(REQUIRED_PRERENDERED_ROUTES).toEqual(Object.values(ART_PRERENDERED_ROUTES));
  });
});

describe("findPrerenderProblems", () => {
  it("passes when each required route is prerendered and regenerates within 5 minutes", () => {
    expect(findPrerenderProblems({ routes: { "/prerendered/home": ISR } })).toEqual([]);
    expect(
      findPrerenderProblems({ routes: { "/prerendered/home": { initialRevalidateSeconds: 300 } } }),
    ).toEqual([]);
  });

  it("fails when the home page became dynamic", () => {
    const problems = findPrerenderProblems({ routes: { "/_not-found": ISR } });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("/prerendered/home is not prerendered");
    expect(findPrerenderProblems({})).toHaveLength(1);
  });

  it("fails when it would never regenerate, or too rarely", () => {
    for (const seconds of [false, 0, 301]) {
      expect(
        findPrerenderProblems({
          routes: { "/prerendered/home": { initialRevalidateSeconds: seconds } },
        }),
      ).toHaveLength(1);
    }
  });
});

describe("prerendered output files", () => {
  it("names each route's files as Next stores them", () => {
    expect(prerenderedFileBase("/")).toBe("index");
    expect(prerenderedFileBase("/prerendered/home")).toBe("prerendered/home");
    expect(prerenderedFileBase("/_not-found")).toBe("_not-found");
    expect(prerenderedRoutes({ routes: { "/a": ISR, "/b": ISR } })).toEqual(["/a", "/b"]);
    expect(prerenderedRoutes({})).toEqual([]);
  });
});
