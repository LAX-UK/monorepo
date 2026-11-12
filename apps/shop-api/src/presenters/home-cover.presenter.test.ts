import { describe, expect, it } from "vitest";
import { createInMemoryHomeCover } from "../test-support/in-memory-home-cover.js";
import { presentAdminHomeCover, presentPublicHomeCover } from "./home-cover.presenter.js";

const key = "shop/artwork/a.jpg";
const resolve = (value: string | null | undefined) =>
  value ? `https://media.test/${value}` : null;

async function savedCover(options: Parameters<typeof createInMemoryHomeCover>[0] = {}) {
  const harness = createInMemoryHomeCover(options);
  harness.addPicture(key);
  const saved = await harness.service.save({
    actorSubjectId: "staff-1",
    idempotencyKey: "key-1",
    mediaKey: key,
    alt: "A river at dusk",
    focal: { x: 0.7, y: 0.4 },
  });
  return { harness, saved };
}

describe("presentPublicHomeCover", () => {
  it("has no cover when none is chosen", () => {
    expect(presentPublicHomeCover(null, resolve)).toEqual({ cover: null });
  });

  it("gives the storefront the slot the shared cover reads, with the measured scrim", async () => {
    const { saved } = await savedCover();
    const { cover } = presentPublicHomeCover(saved, resolve);
    expect(cover).toMatchObject({
      src: `https://media.test/${key}`,
      width: 3200,
      height: 1600,
      focal: { x: 0.7, y: 0.4 },
      zoom: 1,
      alt: "A river at dusk",
      side: "left",
      analysisStatus: "ready",
      colours: { dominant: expect.stringMatching(/^#/) },
      scrim: { desktop: { tone: "light" }, wide: { tone: "light" } },
    });
  });

  it("has no cover when the picture has no public address", async () => {
    const { saved } = await savedCover();
    expect(presentPublicHomeCover(saved, () => null)).toEqual({ cover: null });
  });

  it("has no cover when the stored measuring no longer carries type", async () => {
    const { saved } = await savedCover();
    const unreadable = {
      ...saved,
      analysis: {
        ...saved.analysis,
        breakpoints: { ...saved.analysis.breakpoints, desktop: undefined, wide: undefined },
      },
    };
    expect(presentPublicHomeCover(unreadable, resolve)).toEqual({ cover: null });
  });
});

describe("presentAdminHomeCover", () => {
  it("says the minimum width even when there is no cover", () => {
    expect(presentAdminHomeCover(null, resolve)).toEqual({ cover: null, minimumWidth: 2400 });
  });

  it("shows the picture, its words and the tone that was measured", async () => {
    const { saved } = await savedCover();
    expect(presentAdminHomeCover(saved, resolve)).toEqual({
      cover: {
        mediaKey: key,
        imageUrl: `https://media.test/${key}`,
        width: 3200,
        height: 1600,
        alt: "A river at dusk",
        focal: { x: 0.7, y: 0.4 },
        side: "left",
        tone: "light",
        updatedAt: "2026-11-12T10:00:00.000Z",
      },
      minimumWidth: 2400,
    });
  });
});
