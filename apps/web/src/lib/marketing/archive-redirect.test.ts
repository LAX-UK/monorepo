import { legacyArchiveRedirect } from "@/lib/marketing/archive-redirect";
import { describe, expect, it } from "vitest";

const target = (path: string) => legacyArchiveRedirect(new URL(`https://lax.bid${path}`))?.href;

describe("legacyArchiveRedirect", () => {
  it("sends the bare archive to the Lots view", () => {
    expect(target("/archive")).toBe("https://lax.bid/results?view=lots");
    expect(target("/archive/")).toBe("https://lax.bid/results?view=lots");
  });

  it("keeps filters, sort and page", () => {
    expect(target("/archive?year=2026&categoryId=c1&sort=recent&page=2")).toBe(
      "https://lax.bid/results?view=lots&year=2026&categoryId=c1&sort=recent&page=2",
    );
  });

  it("drops the old layout value, which would clash with the view", () => {
    expect(target("/archive?view=list&year=2026")).toBe(
      "https://lax.bid/results?view=lots&year=2026",
    );
  });

  it("ignores other paths", () => {
    expect(target("/archives")).toBeUndefined();
    expect(target("/results")).toBeUndefined();
    expect(target("/archive/anything")).toBeUndefined();
  });
});
