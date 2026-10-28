import { artworkSummary } from "@/test/artwork-summary.fixture";
import { describe, expect, it } from "vitest";
import { buildHomeNewEditions } from "./home-new-editions";

const editions = (count: number) =>
  Array.from({ length: count }, (_, i) => artworkSummary({ slug: `e${i + 1}` }));

const slugs = (vm: ReturnType<typeof buildHomeNewEditions>) =>
  vm?.items.map((item) => item.slug) ?? [];

describe("buildHomeNewEditions", () => {
  it("leaves out the release and hides when nothing else is on sale", () => {
    expect(
      buildHomeNewEditions({ editions: editions(1), releaseSlug: "e1", availableCount: 1 }),
    ).toBeNull();
  });

  it("shows one, two or three as they are, without the release", () => {
    const one = buildHomeNewEditions({
      editions: editions(2),
      releaseSlug: "e1",
      availableCount: 2,
    });
    expect(slugs(one)).toEqual(["e2"]);
    expect(one?.viewAll.label).toBe("View all 2 editions");
    expect(
      slugs(buildHomeNewEditions({ editions: editions(4), releaseSlug: "e1", availableCount: 4 })),
    ).toEqual(["e2", "e3", "e4"]);
  });

  it("caps at one row of four and never starts a second", () => {
    const vm = buildHomeNewEditions({
      editions: editions(5),
      releaseSlug: "e1",
      availableCount: 9,
    });
    expect(slugs(vm)).toEqual(["e2", "e3", "e4", "e5"]);
    expect(vm?.viewAll).toEqual({
      label: "View all 9 editions",
      href: "/artworks?availability=available",
    });
    expect(
      slugs(buildHomeNewEditions({ editions: editions(5), releaseSlug: null, availableCount: 5 })),
    ).toHaveLength(4);
  });

  it("never shows a sold-out edition", () => {
    const soldOut = artworkSummary({
      slug: "sold",
      availability: { totalEditions: 10, state: "sold_out" },
    });
    expect(
      slugs(
        buildHomeNewEditions({
          editions: [soldOut, ...editions(2)],
          releaseSlug: null,
          availableCount: 2,
        }),
      ),
    ).toEqual(["e1", "e2"]);
  });
});
