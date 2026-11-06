import Link from "next/link";
import { describe, expect, it } from "vitest";
import { hopHref, hopUrl, isHopHref } from "./hop-href";

describe("HopHref", () => {
  it("wraps an address and unwraps it for a plain link", () => {
    const href = hopHref("/switch-account?to=org-1&next=%2Fhome");
    expect(isHopHref(href)).toBe(true);
    expect(hopUrl(href)).toBe("/switch-account?to=org-1&next=%2Fhome");
  });

  it("leaves ordinary addresses alone", () => {
    expect(isHopHref("/home")).toBe(false);
    expect(isHopHref(null)).toBe(false);
    expect(hopUrl("/home")).toBe("/home");
  });

  it("is not a string, so a router link cannot be handed one", () => {
    // @ts-expect-error a HopHref is not accepted where a string address is expected
    const asString: string = hopHref("/home?account=org-1");
    expect(typeof asString).toBe("object");
  });

  it("is refused by next/link", () => {
    // @ts-expect-error a HopHref is not a valid <Link href>
    const link = <Link href={hopHref("/home?account=org-1")}>Open</Link>;
    expect(link).toBeDefined();
  });
});
