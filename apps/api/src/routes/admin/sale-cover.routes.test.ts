import type { CoverAnalysisRecord, MediaAssetRecord } from "@auction/persistence/interfaces";
import { normalizeStaffRoles } from "@auction/types";
import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { SaleCoverService } from "../../services/sale-cover/sale-cover.service.js";
import { InMemorySaleCoverRepository } from "../../testing/in-memory-sale-cover.repository.js";
import type { AdminHono } from "./_shared.js";
import { attachAdminSaleCoverRoutes } from "./sale-cover.routes.js";

const SALE = "b2e48c7a-1f09-4d35-8a6e-5d3c9f7e2b14";
const OTHER_SALE = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const LOT = "0b8f7a31-4c52-4f0e-9d63-1a7c2e5b9d40";
const LOT_ELSEWHERE = "c4d2e6f8-3a1b-4c5d-8e7f-9a0b1c2d3e4f";
const USER = "user-1";

type Session = { role: string; staffRoles: StaffRoles | undefined };
const salesManager: Session = { role: "staff", staffRoles: normalizeStaffRoles(["sales_manager"]) };
const readOnly: Session = { role: "staff", staffRoles: normalizeStaffRoles(["read_only"]) };
const cataloguer: Session = { role: "staff", staffRoles: normalizeStaffRoles(["cataloguer"]) };
const client: Session = { role: "client", staffRoles: undefined };

const media = new Map<string, MediaAssetRecord>();
const analyses = new Map<string, CoverAnalysisRecord>();

function picture(key: string, width: number, height: number) {
  media.set(key, { key, width, height, blurDataURL: "data:image/webp;base64,AAAA" });
}

function setup() {
  const covers = new InMemorySaleCoverRepository();
  covers.addSale(SALE);
  covers.addSale(OTHER_SALE, { status: "draft" });
  covers.addLot(LOT, { saleId: SALE, images: ["uploads/lot-a.jpg", "uploads/lot-b.jpg"] });
  covers.addLot(LOT_ELSEWHERE, { saleId: OTHER_SALE, images: ["uploads/other.jpg"] });
  const service = new SaleCoverService({
    covers,
    media: {
      lookupByKeys: async (keys) =>
        new Map(
          keys.flatMap((key) => (media.has(key) ? [[key, media.get(key)] as const] : [])),
        ) as never,
    },
    analyses: {
      lookupByHashes: async (hashes) =>
        new Map(
          hashes.flatMap((h) => (analyses.has(h) ? [[h, analyses.get(h)] as const] : [])),
        ) as never,
    },
  });
  const platform: AdminHono = new Hono();
  platform.use("*", async (c, next) => {
    const session = JSON.parse(c.req.header("x-test-session") ?? "{}") as Session;
    c.set("userId", USER);
    c.set("userRole", session.role);
    c.set("userStaffRoles", session.staffRoles);
    await next();
  });
  attachAdminSaleCoverRoutes(platform, service);
  const app = new Hono();
  app.route("/admin", platform);

  const as = (session: Session) => {
    const call = (method: string, path: string, body?: unknown) =>
      app.request(`http://test/admin${path}`, {
        method,
        headers: { "content-type": "application/json", "x-test-session": JSON.stringify(session) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    return {
      view: (saleId = SALE) => call("GET", `/sales/${saleId}/cover`),
      setSlot: (slot: string, body: unknown, saleId = SALE) =>
        call("PUT", `/sales/${saleId}/cover/${slot}`, body),
      clearSlot: (slot: string, saleId = SALE) => call("DELETE", `/sales/${saleId}/cover/${slot}`),
      home: (body: unknown, saleId = SALE) => call("PATCH", `/sales/${saleId}/home`, body),
      pins: (body: unknown) => call("PUT", "/home-pins", body),
    };
  };
  return { as, covers };
}

const upload = (key: string, extra: Record<string, unknown> = {}) => ({
  source: { kind: "upload", key },
  focal: { x: 0.7, y: 0.5 },
  zoom: 1,
  alt: "A harbour at dusk",
  ...extra,
});

async function body(res: Response) {
  // biome-ignore lint/suspicious/noExplicitAny: responses are read loosely in this test
  return (await res.json()) as Record<string, any>;
}

beforeEach(() => {
  media.clear();
  analyses.clear();
  picture("uploads/big.jpg", 3600, 1600);
  picture("uploads/small.jpg", 2000, 900);
  picture("uploads/lot-a.jpg", 3000, 2000);
  picture("uploads/other.jpg", 4000, 3000);
});

describe("who may change the cover", () => {
  it("lets a sales manager read and change it", async () => {
    const { as } = setup();
    const person = as(salesManager);
    expect((await person.setSlot("default", upload("uploads/big.jpg"))).status).toBe(200);
    expect((await person.view()).status).toBe(200);
    expect((await person.home({ subtitle: "Evening sale" })).status).toBe(200);
    expect((await person.pins({ saleIds: [SALE] })).status).toBe(200);
  });

  it("lets read-only staff read but not change", async () => {
    const { as } = setup();
    const person = as(readOnly);
    expect((await person.view()).status).toBe(200);
    expect((await person.setSlot("default", upload("uploads/big.jpg"))).status).toBe(403);
    expect((await person.clearSlot("default")).status).toBe(403);
    expect((await person.home({ subtitle: "x" })).status).toBe(403);
    expect((await person.pins({ saleIds: [] })).status).toBe(403);
  });

  it("keeps cataloguers and clients out of the sale's cover", async () => {
    const { as } = setup();
    for (const session of [cataloguer, client]) {
      const person = as(session);
      expect((await person.setSlot("default", upload("uploads/big.jpg"))).status).toBe(403);
      expect((await person.home({ subtitle: "x" })).status).toBe(403);
      expect((await person.pins({ saleIds: [] })).status).toBe(403);
    }
    expect((await as(client).view()).status).toBe(403);
  });
});

describe("setting a cover slot", () => {
  it("stores the slot with the size read from the stored picture and a fingerprint", async () => {
    const { as, covers } = setup();
    const res = await as(salesManager).setSlot("default", upload("uploads/big.jpg"));
    const slot = (await body(res)).data;
    expect(slot).toMatchObject({ key: "uploads/big.jpg", width: 3600, height: 1600, zoom: 1 });
    expect(slot.analysisHash).toMatch(/^[0-9a-f]{16}$/);
    expect(covers.sales.get(SALE)?.coverSlots.default?.alt).toBe("A harbour at dusk");
  });

  it("refuses a picture below the slot's floor, naming the size", async () => {
    const { as, covers } = setup();
    const res = await as(salesManager).setSlot("default", upload("uploads/small.jpg"));
    expect(res.status).toBe(422);
    const json = await body(res);
    expect(json.code).toBe("slot_invalid");
    expect(json.error).toContain("2400");
    expect(covers.sales.get(SALE)?.coverSlots.default).toBeUndefined();
  });

  it("holds the wide slot to 2880 × 1080 and the phone slot to 1200 square", async () => {
    const { as } = setup();
    picture("uploads/phone.jpg", 1200, 1200);
    picture("uploads/tall.jpg", 1200, 1100);
    const person = as(salesManager);
    expect((await person.setSlot("wide", upload("uploads/big.jpg"))).status).toBe(200);
    expect((await person.setSlot("wide", upload("uploads/small.jpg"))).status).toBe(422);
    expect((await person.setSlot("phone", upload("uploads/phone.jpg"))).status).toBe(200);
    expect((await person.setSlot("phone", upload("uploads/tall.jpg"))).status).toBe(422);
  });

  it("counts the zoom: a detail must still be sharp", async () => {
    const { as } = setup();
    const res = await as(salesManager).setSlot("default", upload("uploads/big.jpg", { zoom: 1.6 }));
    expect(res.status).toBe(422);
  });

  it("rejects a crop that cuts the keep area, and accepts one that holds it", async () => {
    const { as } = setup();
    const person = as(salesManager);
    picture("uploads/banner.jpg", 4800, 1200);
    const cut = await person.setSlot(
      "default",
      upload("uploads/banner.jpg", { keep: { x: 0.02, y: 0.1, width: 0.2, height: 0.8 } }),
    );
    expect(cut.status).toBe(422);
    expect((await body(cut)).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "keep_area_cut" })]),
    );

    const held = await person.setSlot(
      "default",
      upload("uploads/big.jpg", { keep: { x: 0.62, y: 0.4, width: 0.16, height: 0.2 } }),
    );
    expect(held.status).toBe(200);
  });

  it("asks to wait when the picture has not been processed yet", async () => {
    const { as } = setup();
    const res = await as(salesManager).setSlot("default", upload("uploads/new.jpg"));
    expect(res.status).toBe(409);
    expect((await body(res)).code).toBe("image_processing");
  });

  it("does not take a web address as a cover", async () => {
    const { as } = setup();
    const res = await as(salesManager).setSlot("default", upload("https://example.com/a.jpg"));
    expect(res.status).toBe(400);
  });

  it("validates focal point, zoom and alt text", async () => {
    const { as } = setup();
    const person = as(salesManager);
    expect(
      (await person.setSlot("default", upload("uploads/big.jpg", { focal: { x: 1.2, y: 0.5 } })))
        .status,
    ).toBe(400);
    expect((await person.setSlot("default", upload("uploads/big.jpg", { zoom: 2.6 }))).status).toBe(
      400,
    );
    expect((await person.setSlot("default", upload("uploads/big.jpg", { alt: "  " }))).status).toBe(
      400,
    );
    expect((await person.setSlot("middle", upload("uploads/big.jpg"))).status).toBe(400);
    expect(
      (
        await person.setSlot(
          "default",
          upload("uploads/big.jpg", { keep: { x: 0.8, y: 0.1, width: 0.4, height: 0.2 } }),
        )
      ).status,
    ).toBe(400);
  });

  it("takes a detail of one of the sale's lots, reading the key from the lot", async () => {
    const { as } = setup();
    const person = as(salesManager);
    picture("uploads/lot-b.jpg", 6000, 4000);
    const res = await person.setSlot("default", {
      source: {
        kind: "lot",
        lotId: LOT,
        imageIndex: 1,
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      },
      focal: { x: 0.5, y: 0.5 },
      zoom: 1,
      alt: "Detail of the valley",
    });
    expect(res.status).toBe(200);
    const slot = (await body(res)).data;
    expect(slot.fromLot).toEqual({
      lotId: LOT,
      imageKey: "uploads/lot-b.jpg",
      crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
    });
    expect(slot).toMatchObject({ width: 3000, height: 2000 });
    expect(slot.key).toBeUndefined();
  });

  it("refuses a lot from another sale, a missing lot and a missing picture", async () => {
    const { as } = setup();
    const person = as(salesManager);
    const lotCover = (lotId: string, imageIndex: number) => ({
      source: { kind: "lot", lotId, imageIndex },
      focal: { x: 0.5, y: 0.5 },
      zoom: 1,
      alt: "A detail",
    });
    expect((await person.setSlot("default", lotCover(LOT_ELSEWHERE, 0))).status).toBe(422);
    expect(
      (await person.setSlot("default", lotCover("11111111-2222-4333-8444-555555555555", 0))).status,
    ).toBe(404);
    expect((await person.setSlot("default", lotCover(LOT, 5))).status).toBe(404);
  });

  it("answers 404 for a sale that does not exist", async () => {
    const { as } = setup();
    const res = await as(salesManager).setSlot(
      "default",
      upload("uploads/big.jpg"),
      "99999999-2222-4333-8444-555555555555",
    );
    expect(res.status).toBe(404);
  });

  it("clears a slot and leaves the others", async () => {
    const { as, covers } = setup();
    const person = as(salesManager);
    await person.setSlot("default", upload("uploads/big.jpg"));
    await person.setSlot("wide", upload("uploads/big.jpg"));
    expect((await person.clearSlot("default")).status).toBe(204);
    expect(Object.keys(covers.sales.get(SALE)?.coverSlots ?? {})).toEqual(["wide"]);
  });
});

describe("reading the cover", () => {
  it("reads the old array by position until a slot is set, and a stored slot wins", async () => {
    const { as, covers } = setup();
    covers.addSale(SALE, { coverImages: ["a.jpg", "b.jpg", "c.jpg"] });
    const person = as(salesManager);
    const before = (await body(await person.view())).data.slots;
    expect(before.default).toMatchObject({ source: "legacy", legacyKey: "a.jpg" });
    expect(before.phone).toMatchObject({ source: "legacy", legacyKey: "b.jpg" });
    expect(before.wide).toMatchObject({ source: "legacy", legacyKey: "c.jpg" });

    await person.setSlot("default", upload("uploads/big.jpg"));
    const after = (await body(await person.view())).data.slots;
    expect(after.default.source).toBe("slot");
    expect(after.phone.source).toBe("legacy");
  });

  it("shows the measured scrim once the worker has stored it, and pending before", async () => {
    const { as } = setup();
    const person = as(salesManager);
    const stored = (await body(await person.setSlot("default", upload("uploads/big.jpg")))).data;
    expect((await body(await person.view())).data.slots.default.analysis.status).toBe("pending");

    analyses.set(stored.analysisHash, {
      hash: stored.analysisHash,
      status: "ready",
      analysis: {
        version: 1,
        dominant: "#303030",
        deepest: "#101010",
        field: "#101010",
        blurDataURL: "data:image/jpeg;base64,AAAA",
        breakpoints: {},
      },
    });
    const ready = (await body(await person.view())).data.slots.default.analysis;
    expect(ready.status).toBe("ready");
    expect(ready.value.dominant).toBe("#303030");
  });
});

describe("home fields", () => {
  it("sets the subtitle, the featured lots in order and the consignment deadline", async () => {
    const { as, covers } = setup();
    const res = await as(salesManager).home({
      subtitle: "Evening sale of modern British art",
      featuredLotIds: [LOT],
      consignmentDeadline: "2026-12-01T00:00:00.000Z",
    });
    expect(res.status).toBe(200);
    expect(covers.sales.get(SALE)).toMatchObject({
      subtitle: "Evening sale of modern British art",
      featuredLotIds: [LOT],
    });
    expect(covers.sales.get(SALE)?.consignmentDeadline?.toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });

  it("leaves what it is not given, and clears with null or an empty subtitle", async () => {
    const { as, covers } = setup();
    const person = as(salesManager);
    await person.home({ subtitle: "Keep", consignmentDeadline: "2026-12-01T00:00:00.000Z" });
    await person.home({ featuredLotIds: [LOT] });
    expect(covers.sales.get(SALE)?.subtitle).toBe("Keep");
    await person.home({ subtitle: "", consignmentDeadline: null });
    expect(covers.sales.get(SALE)?.subtitle).toBeNull();
    expect(covers.sales.get(SALE)?.consignmentDeadline).toBeNull();
  });

  it("refuses featured lots that are not in the sale, repeated, or too many", async () => {
    const { as } = setup();
    const person = as(salesManager);
    expect((await person.home({ featuredLotIds: [LOT_ELSEWHERE] })).status).toBe(422);
    expect((await person.home({ featuredLotIds: [LOT, LOT] })).status).toBe(422);
    const many = Array.from(
      { length: 13 },
      (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect((await person.home({ featuredLotIds: many })).status).toBe(400);
  });

  it("limits the subtitle and requires a change", async () => {
    const { as } = setup();
    const person = as(salesManager);
    expect((await person.home({ subtitle: "x".repeat(161) })).status).toBe(400);
    expect((await person.home({})).status).toBe(400);
  });
});

describe("home pins", () => {
  it("pins up to three published sales in order and unpins the rest", async () => {
    const { as, covers } = setup();
    const third = "d1e2f3a4-5b6c-4d7e-8f90-a1b2c3d4e5f6";
    covers.addSale(third, { status: "scheduled" });
    const person = as(salesManager);
    expect((await person.pins({ saleIds: [third, SALE] })).status).toBe(200);
    expect(covers.sales.get(third)?.homePinOrder).toBe(1);
    expect(covers.sales.get(SALE)?.homePinOrder).toBe(2);
    expect((await person.pins({ saleIds: [SALE] })).status).toBe(200);
    expect(covers.sales.get(third)?.homePinOrder).toBeNull();
    expect(covers.sales.get(SALE)?.homePinOrder).toBe(1);
    expect((await person.pins({ saleIds: [] })).status).toBe(200);
    expect(covers.sales.get(SALE)?.homePinOrder).toBeNull();
  });

  it("lists every pinned sale in order with the cover view", async () => {
    const { as, covers } = setup();
    const third = "d1e2f3a4-5b6c-4d7e-8f90-a1b2c3d4e5f6";
    covers.addSale(third, { status: "scheduled" });
    const person = as(salesManager);
    expect((await body(await person.view())).data.pins).toEqual([]);
    await person.pins({ saleIds: [third, SALE] });
    const pins = (await body(await person.view())).data.pins;
    expect(pins.map((pin: { saleId: string }) => pin.saleId)).toEqual([third, SALE]);
    expect(pins.map((pin: { position: number }) => pin.position)).toEqual([1, 2]);
  });

  it("refuses a draft sale, a repeat and more than three", async () => {
    const { as } = setup();
    const person = as(salesManager);
    expect((await person.pins({ saleIds: [OTHER_SALE] })).status).toBe(422);
    expect((await person.pins({ saleIds: [SALE, SALE] })).status).toBe(422);
    const ids = ["a", "b", "c", "d"].map((c) => `${c.repeat(8)}-1111-4111-8111-111111111111`);
    expect((await person.pins({ saleIds: ids })).status).toBe(400);
  });
});
