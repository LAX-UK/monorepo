import type { SaleCoverSlotAsset, SaleCoverSlotAssets } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  type BidCoverLot,
  type BidCoverSaleVM,
  photoFromCover,
  plateFromLot,
  toBidCoverSlide,
  toBidCoverSlides,
  withBidViewer,
} from "./bid-cover.adapter";

const now = new Date("2026-11-01T15:25:00Z");
const links = { register: "/register", bids: "/account/bids", sell: "/sell", contact: "/contact" };
const context = { now, viewer: "anonymous" as const, links };

const slot = (over: Partial<SaleCoverSlotAsset> = {}): SaleCoverSlotAsset => ({
  src: "https://cdn.test/cover.jpg",
  width: 3200,
  height: 1400,
  blurDataURL: "data:image/jpeg;base64,AAAA",
  focal: { x: 0.7, y: 0.5 },
  zoom: 1.2,
  alt: "Estuary, Evening",
  side: "left",
  analysisStatus: "ready",
  colours: { dominant: "#3e6a86", deepest: "#162936", field: "#162936" },
  scrim: { desktop: { tone: "light", strength: 0.45, creditBand: 0.5 }, wide: null },
  ...over,
});

const lot: BidCoverLot = {
  id: "lot-4",
  href: "/lots/lot-4",
  label: "Lot 4",
  title: "Estuary, Evening",
  priceLine: "current bid £7,000",
  image: { src: "https://cdn.test/lot.jpg", width: 1500, height: 1000, field: "#162936" },
};

const sale = (over: Partial<BidCoverSaleVM> = {}): BidCoverSaleVM => ({
  id: "sale-1",
  href: "/sales/sale-1",
  title: "Modern & Contemporary: Online",
  status: "active",
  deliveryMode: "online",
  startsAt: new Date("2026-10-27T09:00:00Z"),
  endsAt: new Date("2026-11-03T21:00:00Z"),
  lotCount: 8,
  subtitle: null,
  cover: { default: slot() },
  lot,
  ...over,
});

describe("photoFromCover", () => {
  it("uses a measured default slot that reaches the floor", () => {
    const photo = photoFromCover({ default: slot() });
    expect(photo?.kind).toBe("photo");
    expect(photo?.colour).toBe("#3e6a86");
    expect(photo?.scrim.desktop?.tone).toBe("light");
  });
  it.each([
    ["is below the 2400px floor", { width: 2000 }],
    ["has not been measured", { analysisStatus: "pending" as const }],
    ["cannot reach contrast", { scrim: { desktop: null, wide: null } }],
    ["has no colours", { colours: null }],
  ])("is not used when the slot %s", (_name, over) => {
    expect(photoFromCover({ default: slot(over) })).toBeNull();
  });
  it("passes the wide and phone slots through for the component to size-check", () => {
    const cover: SaleCoverSlotAssets = {
      default: slot(),
      wide: slot({
        src: "w",
        width: 3840,
        scrim: { desktop: null, wide: { tone: "light", strength: 0.5, creditBand: 0.4 } },
      }),
      phone: slot({ src: "p", width: 1600, height: 1600 }),
    };
    const photo = photoFromCover(cover);
    expect(photo?.slots.wide?.src).toBe("w");
    expect(photo?.slots.phone?.src).toBe("p");
    expect(photo?.scrim.wide?.strength).toBe(0.5);
  });
  it("is null without a cover", () => {
    expect(photoFromCover(undefined)).toBeNull();
  });
});

describe("plateFromLot", () => {
  it("hangs a big enough photograph whole on its field", () => {
    const plate = plateFromLot(lot);
    expect(plate).toMatchObject({ kind: "plate", field: "#162936", tone: "light" });
  });
  it("needs 800px on the long side", () => {
    const small = { src: "s", field: "#162936", width: 500, height: 600 };
    expect(plateFromLot({ ...lot, image: small })).toBeNull();
    expect(plateFromLot({ ...lot, image: null })).toBeNull();
    expect(plateFromLot(null)).toBeNull();
  });
});

describe("toBidCoverSlide", () => {
  it("maps a live sale: photo first, then the plate, credited to the lot", () => {
    const slide = toBidCoverSlide(sale(), context);
    expect(slide.badge).toBe("Live");
    expect(slide.time).toBe("Lots close from Tue 3 Nov, 21:00 GMT · 2 days 5 hours left");
    expect(slide.media.map((m) => m.kind)).toEqual(["photo", "plate"]);
    expect(slide.credit).toEqual({
      text: "Lot 4 · Estuary, Evening (detail) · current bid £7,000",
      href: "/lots/lot-4",
    });
    expect(slide.primary).toEqual({ label: "View lots", href: "/sales/sale-1" });
    expect(slide.link).toEqual({ label: "Register to bid", href: "/register" });
    expect(slide.fact).toBe("Online, timed · 8 lots");
  });

  it("uses the subtitle as the one line of fact", () => {
    expect(toBidCoverSlide(sale({ subtitle: "British paintings" }), context).fact).toBe(
      "British paintings",
    );
  });

  it("leads with the plate when the cover is unusable", () => {
    const slide = toBidCoverSlide(sale({ cover: undefined }), context);
    expect(slide.media.map((m) => m.kind)).toEqual(["plate"]);
    expect(slide.credit?.text).toBe("Lot 4 · Estuary, Evening · current bid £7,000");
  });

  it("is type only, without a credit, when no picture can lead", () => {
    const slide = toBidCoverSlide(sale({ cover: undefined, lot: null }), context);
    expect(slide.media).toEqual([]);
    expect(slide.credit).toBeUndefined();
  });

  it("words upcoming and ended sales", () => {
    const upcoming = toBidCoverSlide(
      sale({ status: "scheduled", startsAt: new Date("2026-11-10T21:00:00Z"), endsAt: null }),
      context,
    );
    expect(upcoming.badge).toBe("Upcoming");
    expect(upcoming.time).toBe("Opens Tue 10 Nov, 21:00 GMT");
    expect(upcoming.primary.label).toBe("Preview the lots");
    const ended = toBidCoverSlide(
      sale({ status: "ended", endsAt: new Date("2026-10-15T20:00:00Z") }),
      context,
    );
    expect(ended.time).toBe("Ended Thu 15 Oct");
    expect(ended.primary.label).toBe("See the results");
    expect(ended.link).toEqual({ label: "Sell with LAX", href: "/sell" });
  });

  it("swaps the register prompt for the viewer's real next step", () => {
    const approved = toBidCoverSlide(sale(), { ...context, viewer: "approved" });
    expect(approved.link).toEqual({ label: "Your bids", href: "/account/bids" });
    expect(approved.status).toEqual({ icon: "check", text: "You’re approved to bid in this sale" });
    const pending = toBidCoverSlide(sale(), { ...context, viewer: "pending" });
    expect(pending.link).toEqual({
      label: "Check your registration",
      href: "/sales/sale-1#register-to-bid",
    });
    expect(pending.status?.icon).toBe("clock");
    const declined = toBidCoverSlide(sale(), { ...context, viewer: "declined" });
    expect(declined.link).toEqual({ label: "Contact us", href: "/contact" });
    expect(declined.status).toEqual({
      icon: "info",
      text: "Your registration for this sale wasn’t approved.",
    });
  });

  it("shows no registration status on a finished sale", () => {
    const ended = toBidCoverSlide(
      sale({ status: "ended", endsAt: new Date("2026-10-15T20:00:00Z") }),
      { ...context, viewer: "approved" },
    );
    expect(ended.status).toBeUndefined();
    expect(ended.link?.label).toBe("Sell with LAX");
  });

  it("applies a viewer to a rendered slide without touching anything else", () => {
    const base = toBidCoverSlide(sale(), context);
    const swapped = withBidViewer(base, sale(), "approved", links);
    expect(swapped.link).toEqual({ label: "Your bids", href: "/account/bids" });
    expect(swapped.status?.icon).toBe("check");
    expect({ ...swapped, link: undefined, status: undefined }).toEqual({
      ...base,
      link: undefined,
      status: undefined,
    });
    expect(withBidViewer(swapped, sale(), "anonymous", links).status).toBeUndefined();
  });

  it("carries a film on the slide", () => {
    const film = { src: "https://www.youtube.com/embed/x", title: "Sale film" };
    expect(toBidCoverSlide(sale({ film }), context).film).toEqual(film);
    expect(toBidCoverSlide(sale(), context).film).toBeUndefined();
  });

  it("maps several pinned sales in order", () => {
    const slides = toBidCoverSlides([sale({ id: "a" }), sale({ id: "b" })], context);
    expect(slides.map((s) => s.id)).toEqual(["a", "b"]);
  });
});
