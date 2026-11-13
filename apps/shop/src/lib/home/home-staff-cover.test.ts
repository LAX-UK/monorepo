import type { PublicHomeCover } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { chooseShopHeroCover } from "./home-cover.adapter";
import { readStaffCover } from "./home-staff-cover";

const picture: NonNullable<PublicHomeCover["cover"]> = {
  src: "https://media.test/shop/artwork/a.jpg",
  width: 3200,
  height: 1600,
  blurDataURL: "data:image/webp;base64,AAAA",
  focal: { x: 0.7, y: 0.4 },
  zoom: 1,
  alt: "A river at dusk",
  side: "left",
  analysisStatus: "ready",
  colours: { dominant: "#181c28", deepest: "#0c0e14", field: "#0c0e14" },
  scrim: {
    desktop: { tone: "light", strength: 0.6, creditBand: 0.5 },
    wide: { tone: "light", strength: 0.6, creditBand: 0.5 },
  },
};

describe("readStaffCover", () => {
  it("has no cover when staff have not chosen one, so the home leads as before", async () => {
    expect(await readStaffCover(async () => ({ cover: null }))).toBeNull();
  });

  it("turns the chosen picture into the cover photograph the shared cover draws", async () => {
    const photo = await readStaffCover(async () => ({ cover: picture }));
    expect(photo).toMatchObject({
      kind: "photo",
      alt: "A river at dusk",
      side: "left",
      colour: "#181c28",
      slots: { default: { src: picture.src, focal: { x: 0.7, y: 0.4 }, zoom: 1 } },
      scrim: { desktop: { tone: "light" } },
    });
    expect(chooseShopHeroCover({ staffCover: photo, plate: null })).toBe("staff-photo");
  });

  it("has no cover when the picture is narrower than the floor", async () => {
    expect(await readStaffCover(async () => ({ cover: { ...picture, width: 1200 } }))).toBeNull();
  });

  it("has no cover when the type cannot be read on it", async () => {
    const unreadable = { ...picture, scrim: { desktop: null, wide: null } };
    expect(await readStaffCover(async () => ({ cover: unreadable }))).toBeNull();
  });

  it("has no cover when the read fails, rather than breaking the home", async () => {
    expect(
      await readStaffCover(async () => {
        throw new Error("down");
      }),
    ).toBeNull();
  });
});
