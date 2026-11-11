import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createInternalInventoryRoutes } from "./internal-inventory.routes.js";

const credentials = {
  INVENTORY_MACHINE_CLIENT_ID: "inventory-move",
  INVENTORY_MACHINE_CLIENT_SECRET: "inventory-machine-secret-at-least-32-chars",
};
const headers = {
  "x-inventory-client-id": credentials.INVENTORY_MACHINE_CLIENT_ID,
  "x-inventory-client-secret": credentials.INVENTORY_MACHINE_CLIENT_SECRET,
  "content-type": "application/json",
};
const body = {
  registerId: "11111111-1111-4111-8111-111111111111",
  saleId: "22222222-2222-4222-8222-222222222222",
  startingPrice: "250.00",
  actor: "staff:user-1",
  content: {
    title: "Blue room",
    artistName: "A. Artist",
    medium: null,
    dimensions: null,
    year: null,
    description: null,
    provenance: null,
    imageUrls: [],
  },
};

function createApp(
  env: Partial<typeof credentials> = credentials,
  createDraft = vi.fn().mockResolvedValue({
    ok: true,
    data: { lotId: "33333333-3333-4333-8333-333333333333", saleId: body.saleId, created: true },
  }),
) {
  const listSales = vi
    .fn()
    .mockResolvedValue([
      { id: body.saleId, title: "Winter sale", startsAt: "2026-12-01T10:00:00.000Z" },
    ]);
  const findDraft = vi.fn().mockResolvedValue({
    lotId: "33333333-3333-4333-8333-333333333333",
    saleId: body.saleId,
    saleTitle: "Winter sale",
  });
  const describe = vi.fn().mockResolvedValue({
    lotId: "33333333-3333-4333-8333-333333333333",
    status: "draft",
    saleStatus: "draft",
    title: "Blue",
    medium: null,
    dimensions: null,
    imageUrls: [],
  });
  const updateDraft = vi.fn().mockResolvedValue({
    ok: true,
    data: { lotId: "33333333-3333-4333-8333-333333333333" },
  });
  const app = new Hono().route(
    "/internal/inventory",
    createInternalInventoryRoutes(
      {
        inventoryMoves: {
          draftLots: { listSales, createDraft, findDraft },
          lotCatalogue: { describe, updateDraft },
          returnToLaxArt: {} as never,
        },
      },
      env as never,
    ),
  );
  return { app, listSales, createDraft, findDraft, describe, updateDraft };
}

describe("internal inventory routes (Bid)", () => {
  it("is closed until the credential is configured", async () => {
    const { app } = createApp({});
    const response = await app.request("/internal/inventory/auction-sales", { headers });
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "not_configured" });
  });

  it("refuses a missing or wrong credential", async () => {
    const { app, listSales } = createApp();
    expect((await app.request("/internal/inventory/auction-sales")).status).toBe(401);
    const wrong = await app.request("/internal/inventory/auction-sales", {
      headers: { ...headers, "x-inventory-client-secret": "x".repeat(40) },
    });
    expect(wrong.status).toBe(401);
    expect(listSales).not.toHaveBeenCalled();
  });

  it("lists the sales that can take an original", async () => {
    const { app } = createApp();
    const response = await app.request("/internal/inventory/auction-sales", { headers });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      sales: [{ id: body.saleId, title: "Winter sale", startsAt: "2026-12-01T10:00:00.000Z" }],
    });
  });

  it("tells LAX Admin which draft lot holds a record's place", async () => {
    const { app, findDraft } = createApp();
    const response = await app.request(`/internal/inventory/draft-lots/${body.registerId}`, {
      headers,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      lot: {
        lotId: "33333333-3333-4333-8333-333333333333",
        saleId: body.saleId,
        saleTitle: "Winter sale",
      },
    });
    expect(findDraft).toHaveBeenCalledWith(body.registerId);
  });

  it("answers no lot when there is none, and refuses an id that is not an id", async () => {
    const { app, findDraft } = createApp();
    findDraft.mockResolvedValueOnce(null);
    const none = await app.request(`/internal/inventory/draft-lots/${body.registerId}`, {
      headers,
    });
    expect(await none.json()).toEqual({ lot: null });
    const bad = await app.request("/internal/inventory/draft-lots/nope", { headers });
    expect(bad.status).toBe(400);
  });

  it("keeps the draft-lot lookup behind the credential", async () => {
    const { app, findDraft } = createApp();
    const response = await app.request(`/internal/inventory/draft-lots/${body.registerId}`);
    expect(response.status).toBe(401);
    expect(findDraft).not.toHaveBeenCalled();
  });

  it("makes the draft lot and answers with it", async () => {
    const { app, createDraft } = createApp();
    const response = await app.request("/internal/inventory/draft-lots", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ created: true, saleId: body.saleId });
    expect(createDraft).toHaveBeenCalledWith(body);
  });

  it("rejects a request that is not in the contract's shape", async () => {
    const { app, createDraft } = createApp();
    const response = await app.request("/internal/inventory/draft-lots", {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, actor: "system" }),
    });
    expect(response.status).toBe(400);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it("passes a refusal on with its status and reason", async () => {
    const { app } = createApp(
      credentials,
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        refusal: { error: "sale_not_open", message: "That sale is no longer open for new lots." },
      }),
    );
    const response = await app.request("/internal/inventory/draft-lots", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "sale_not_open",
      message: "That sale is no longer open for new lots.",
    });
  });

  it("tells LAX Admin what the lot holding a record says", async () => {
    const { app, describe } = createApp();
    const response = await app.request(`/internal/inventory/lot-catalogue/${body.registerId}`, {
      headers,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ lot: { status: "draft", title: "Blue" } });
    expect(describe).toHaveBeenCalledWith(body.registerId);
  });

  it("asks a draft lot to take Zoho's details, and passes a refusal on", async () => {
    const { app, updateDraft } = createApp();
    const send = () =>
      app.request(`/internal/inventory/lot-catalogue/${body.registerId}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          actor: "staff:abc",
          content: { title: "Green", medium: "Oil", dimensions: null, imageUrls: [] },
        }),
      });
    expect((await send()).status).toBe(200);
    updateDraft.mockResolvedValueOnce({
      ok: false,
      status: 409,
      refusal: { error: "lot_not_draft", message: "Not a draft." },
    });
    const refused = await send();
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "lot_not_draft", message: "Not a draft." });
  });
});
