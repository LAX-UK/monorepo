import { describe, expect, it } from "vitest";
import { DEMO_ARTIST_LIST, UNATTRIBUTED_WORKS, WORK_ARTIST } from "./demo-artists.js";
import { buildFullCatalogue } from "./demo-full-catalogue.js";
import { WORKS, type WorkKey } from "./demo-full-works.js";
import { buildDemoCatalogue } from "./demo-topup-catalogue.js";

const actors = {
  collectorUserId: "collector",
  collectorEntityId: "collector-entity",
  rivalUserId: "rival",
  rivalEntityId: "rival-entity",
  northbankBuyerUserId: "buyer",
  northbankOwnerUserId: "owner",
  northbankId: "northbank",
  consignorUserId: "consignor",
  heldUserId: "held",
  heldEntityId: "held-entity",
  payerUserId: "payer",
  payerEntityId: "payer-entity",
  laxStockId: "lax",
};
const NOW = Date.UTC(2026, 10, 6, 9, 0);
const full = buildFullCatalogue(NOW, actors);
const topUp = buildDemoCatalogue(NOW, actors);
const known = new Set(DEMO_ARTIST_LIST.map((a) => a.id));

describe("demo lot artists", () => {
  it("gives every top-up lot a registered artist", () => {
    expect(topUp.lots.length).toBeGreaterThan(0);
    for (const lot of topUp.lots) {
      expect(lot.artistId, lot.title).not.toBeNull();
      expect(known.has(lot.artistId ?? ""), lot.title).toBe(true);
    }
  });

  it("gives every full-catalogue lot a registered artist, except the listed anonymous works", () => {
    const anonymous = new Set(
      Object.keys(UNATTRIBUTED_WORKS).map((k) => WORKS[k as WorkKey].title),
    );
    for (const lot of full.lots) {
      if (anonymous.has(lot.title)) {
        expect(lot.artistId, lot.title).toBeNull();
      } else {
        expect(known.has(lot.artistId ?? ""), lot.title).toBe(true);
      }
    }
  });

  it("explains every work left without an artist, and only those", () => {
    const withoutArtist = (Object.keys(WORK_ARTIST) as WorkKey[]).filter((k) => !WORK_ARTIST[k]);
    expect(withoutArtist.sort()).toEqual(Object.keys(UNATTRIBUTED_WORKS).sort());
  });

  it("covers every work and links real makers to their own profile", () => {
    expect(Object.keys(WORK_ARTIST).sort()).toEqual(Object.keys(WORKS).sort());
    const nameOf = (work: WorkKey) =>
      DEMO_ARTIST_LIST.find(
        (a) => a.id === full.lots.find((l) => l.title === WORKS[work].title)?.artistId,
      )?.displayName;
    expect(nameOf("hiroshige")).toBe("Utagawa Hiroshige");
    expect(nameOf("threeWomen")).toBe("Rembrandt van Rijn");
    expect(nameOf("greatWave")).toBe("Katsushika Hokusai");
  });

  it("uses unique ids and slugs", () => {
    expect(new Set(DEMO_ARTIST_LIST.map((a) => a.id)).size).toBe(DEMO_ARTIST_LIST.length);
    expect(new Set(DEMO_ARTIST_LIST.map((a) => a.slug)).size).toBe(DEMO_ARTIST_LIST.length);
  });
});
