import { describe, expect, it } from "vitest";
import { resolvePrerenderedDirectVisit, resolvePrerenderedRewrite } from "./prerendered-routes";

const BROWSER_DOCUMENT = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
};
const ROUTER_FETCH = { accept: "text/x-component", "sec-fetch-dest": "empty" };

function request(pathname: string, headers: Record<string, string> = {}, method = "GET") {
  return { method, pathname, headers: new Headers(headers) };
}

describe("resolvePrerenderedRewrite", () => {
  it("serves a document request for the home page from its prerendered copy", () => {
    expect(resolvePrerenderedRewrite(request("/", BROWSER_DOCUMENT))).toBe("/prerendered/home");
    expect(resolvePrerenderedRewrite(request("/", BROWSER_DOCUMENT, "HEAD"))).toBe(
      "/prerendered/home",
    );
  });

  it("serves crawlers and clients without fetch metadata the prerendered copy too", () => {
    expect(resolvePrerenderedRewrite(request("/", { accept: "text/html" }))).toBe(
      "/prerendered/home",
    );
    expect(resolvePrerenderedRewrite(request("/", { accept: "*/*" }))).toBe("/prerendered/home");
    expect(resolvePrerenderedRewrite(request("/"))).toBe("/prerendered/home");
  });

  it("leaves in-app navigation, prefetches and server actions to the home route", () => {
    expect(resolvePrerenderedRewrite(request("/", ROUTER_FETCH))).toBeNull();
    // An older browser without fetch metadata still asks for the RSC payload by type.
    expect(resolvePrerenderedRewrite(request("/", { accept: "text/x-component" }))).toBeNull();
    expect(
      resolvePrerenderedRewrite(
        request("/", { accept: "text/x-component", "next-action": "abc" }, "POST"),
      ),
    ).toBeNull();
    expect(resolvePrerenderedRewrite(request("/", { "sec-fetch-dest": "iframe" }))).toBeNull();
  });

  it("leaves every other page alone", () => {
    expect(resolvePrerenderedRewrite(request("/visit", BROWSER_DOCUMENT))).toBeNull();
    expect(resolvePrerenderedRewrite(request("/artworks", BROWSER_DOCUMENT))).toBeNull();
  });
});

describe("resolvePrerenderedDirectVisit", () => {
  it("sends a direct visit to a prerendered copy to its public page", () => {
    expect(resolvePrerenderedDirectVisit("/prerendered/home")).toBe("/");
    expect(resolvePrerenderedDirectVisit("/prerendered")).toBe("/");
    expect(resolvePrerenderedDirectVisit("/prerendered/anything")).toBe("/");
  });

  it("leaves public pages alone", () => {
    expect(resolvePrerenderedDirectVisit("/")).toBeNull();
    expect(resolvePrerenderedDirectVisit("/prerendered-works")).toBeNull();
  });
});
