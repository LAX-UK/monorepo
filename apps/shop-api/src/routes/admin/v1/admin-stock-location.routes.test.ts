import { MOVE_BATCH_MAX } from "@auction/artwork-register-contracts";
import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES, isStepUpPath } from "@auction/shop-contracts";
import { SHOP_STAFF_ROLES, type ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { FieldValidationError } from "../../../errors/field-validation-error.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const TOKEN = "admin-token-placeholder-minimum-length";
const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const REGISTER_ID = "44444444-4444-4444-8444-444444444444";
const KEY = "move-key-0001";

/**
 * Who may do what. Moving is for the people responsible for the catalogue and Administrators
 * (owner decision, 17 Nov 2026); every other role is refused with a 403.
 */
const CAN_READ: ShopStaffRole[] = ["shop_admin", "catalogue_editor", "read_only"];
const CAN_MOVE: ShopStaffRole[] = ["shop_admin", "catalogue_editor"];
const CAN_MANAGE: ShopStaffRole[] = ["shop_admin"];

const location = {
  id: LOCATION_ID,
  name: "Store room",
  note: null,
  status: "active",
  label: "Store room",
  version: 1,
  createdAt: "2026-11-17T09:00:00.000Z",
  updatedAt: "2026-11-17T09:00:00.000Z",
  retiredAt: null,
};
const writeResult = { changed: true, location };
const moveResult = {
  locationId: LOCATION_ID,
  moved: [{ registerId: REGISTER_ID, fromLocationId: null }],
  unchanged: [],
  notFound: [],
};
const artworkLocation = {
  registerId: REGISTER_ID,
  label: "Store room",
  current: {
    location: { id: LOCATION_ID, name: "Store room", status: "active", label: "Store room" },
    movedAt: "2026-11-17T09:00:00.000Z",
    movedBy: "staff:someone",
    movedByName: "Ana Ruiz",
  },
  moves: [],
  moreMoves: false,
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function buildApp(role: ShopStaffRole, options: { authTime?: number } = {}) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: options.authTime ?? nowSeconds(),
    },
  } as never);
  const deps = createMinimalShopApiTestDeps({
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject: string) => ({
        roles: [role],
        identitySubjectId: subject,
      }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  const stockLocations = {
    listLocations: vi.fn(async () => ({ items: [location] })),
    artworkLocation: vi.fn(async (): Promise<typeof artworkLocation | null> => artworkLocation),
    addLocation: vi.fn(async () => writeResult),
    updateLocation: vi.fn(async () => writeResult),
    retireLocation: vi.fn(async () => writeResult),
    restoreLocation: vi.fn(async () => writeResult),
    moveArtworks: vi.fn(async () => moveResult),
  };
  deps.admin.stockLocations = stockLocations as never;
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, stockLocations };
}

const headers = { authorization: `Bearer ${TOKEN}`, "idempotency-key": KEY };

type Probe = {
  name: string;
  method: "GET" | "POST" | "PATCH";
  url: string;
  payload?: Record<string, unknown>;
  allowed: ShopStaffRole[];
  call: keyof Awaited<ReturnType<typeof buildApp>>["stockLocations"];
};

const PROBES: Probe[] = [
  {
    name: "list locations",
    method: "GET",
    url: "/admin/v1/artwork-locations?includeRetired=true",
    allowed: CAN_READ,
    call: "listLocations",
  },
  {
    name: "read an artwork's location and history",
    method: "GET",
    url: `/admin/v1/artwork-register/${REGISTER_ID}/location`,
    allowed: CAN_READ,
    call: "artworkLocation",
  },
  {
    name: "move artworks",
    method: "POST",
    url: "/admin/v1/artwork-location-moves",
    payload: { registerIds: [REGISTER_ID], locationId: LOCATION_ID, note: "For the hang" },
    allowed: CAN_MOVE,
    call: "moveArtworks",
  },
  {
    name: "add a location",
    method: "POST",
    url: "/admin/v1/artwork-locations",
    payload: { name: "Store room", note: null },
    allowed: CAN_MANAGE,
    call: "addLocation",
  },
  {
    name: "rename a location",
    method: "PATCH",
    url: `/admin/v1/artwork-locations/${LOCATION_ID}`,
    payload: { expectedVersion: 1, name: "Store room B", note: "Back corridor" },
    allowed: CAN_MANAGE,
    call: "updateLocation",
  },
  {
    name: "retire a location",
    method: "POST",
    url: `/admin/v1/artwork-locations/${LOCATION_ID}/retire`,
    payload: { expectedVersion: 1 },
    allowed: CAN_MANAGE,
    call: "retireLocation",
  },
  {
    name: "restore a location",
    method: "POST",
    url: `/admin/v1/artwork-locations/${LOCATION_ID}/restore`,
    payload: { expectedVersion: 2 },
    allowed: CAN_MANAGE,
    call: "restoreLocation",
  },
];

describe("stock location routes: who may do what", () => {
  const cases = PROBES.flatMap((probe) =>
    SHOP_STAFF_ROLES.map((role) => ({ probe, role, allowed: probe.allowed.includes(role) })),
  );

  it.each(cases)("$probe.name as $role → allowed: $allowed", async ({ probe, role, allowed }) => {
    const { app, stockLocations } = await buildApp(role);
    const response = await app.inject({
      method: probe.method,
      url: probe.url,
      headers,
      ...(probe.payload ? { payload: probe.payload } : {}),
    });
    await app.close();
    if (allowed) {
      expect(response.statusCode, response.body).toBe(200);
      expect(stockLocations[probe.call]).toHaveBeenCalledOnce();
    } else {
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe(SHOP_API_ERROR_CODES.FORBIDDEN);
      expect(stockLocations[probe.call]).not.toHaveBeenCalled();
    }
  });

  it("lets a Catalogue editor open the From Zoho record, where Move sits, as well as move", async () => {
    const { app } = await buildApp("catalogue_editor");
    const register = await app.inject({
      method: "GET",
      url: `/admin/v1/artwork-register/${REGISTER_ID}`,
      headers,
    });
    await app.close();
    expect(register.statusCode).not.toBe(403);
  });

  it.each(["account_manager", "operations"] as const)(
    "refuses a move from %s, who moved artworks before the owner's decision",
    async (role) => {
      const { app, stockLocations } = await buildApp(role);
      const response = await app.inject({
        method: "POST",
        url: "/admin/v1/artwork-location-moves",
        headers,
        payload: { registerIds: [REGISTER_ID], locationId: LOCATION_ID },
      });
      await app.close();
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe(SHOP_API_ERROR_CODES.FORBIDDEN);
      expect(stockLocations.moveArtworks).not.toHaveBeenCalled();
    },
  );
});

describe("keeping the list needs a recent sign-in", () => {
  const stale = () => nowSeconds() - 24 * 60 * 60;
  const manageProbes = PROBES.filter((probe) => probe.allowed === CAN_MANAGE);

  it.each(manageProbes)(
    "$name is refused for an Administrator who signed in long ago",
    async (probe) => {
      const { app, stockLocations } = await buildApp("shop_admin", { authTime: stale() });
      const response = await app.inject({
        method: probe.method,
        url: probe.url,
        headers,
        ...(probe.payload ? { payload: probe.payload } : {}),
      });
      await app.close();
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe(SHOP_API_ERROR_CODES.STEP_UP_REQUIRED);
      expect(stockLocations[probe.call]).not.toHaveBeenCalled();
      expect(isStepUpPath(new URL(probe.url, "http://x").pathname)).toBe(true);
    },
  );

  it("does not ask a mover to sign in again", async () => {
    const { app, stockLocations } = await buildApp("catalogue_editor", { authTime: stale() });
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/artwork-location-moves",
      headers,
      payload: { registerIds: [REGISTER_ID], locationId: LOCATION_ID },
    });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(stockLocations.moveArtworks).toHaveBeenCalledOnce();
    expect(isStepUpPath("/admin/v1/artwork-location-moves")).toBe(false);
  });
});

describe("move requests", () => {
  const ids = (count: number) =>
    Array.from(
      { length: count },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );

  async function move(payload: unknown, extraHeaders: Record<string, string> = headers) {
    const { app, stockLocations } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/artwork-location-moves",
      headers: extraHeaders,
      payload: payload as Record<string, unknown>,
    });
    await app.close();
    return { response, stockLocations };
  }

  it("passes the parsed body, the actor and the key to the service", async () => {
    const { response, stockLocations } = await move({
      registerIds: [REGISTER_ID, REGISTER_ID],
      locationId: LOCATION_ID,
      note: "Hang for the winter show",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(moveResult);
    expect(stockLocations.moveArtworks).toHaveBeenCalledWith({
      actorSubjectId: "catalogue_editor-subject",
      idempotencyKey: KEY,
      request: {
        registerIds: [REGISTER_ID, REGISTER_ID],
        locationId: LOCATION_ID,
        note: "Hang for the winter show",
      },
    });
  });

  it(`takes ${MOVE_BATCH_MAX} artworks and refuses one more before reaching the service`, async () => {
    // The longest note, in four-byte characters, so the body is as large as a valid move gets.
    const atLimit = await move({
      registerIds: ids(MOVE_BATCH_MAX),
      locationId: LOCATION_ID,
      note: "🖼".repeat(500),
    });
    expect(atLimit.response.statusCode, atLimit.response.body).toBe(200);

    const over = await move({ registerIds: ids(MOVE_BATCH_MAX + 1), locationId: LOCATION_ID });
    expect(over.response.statusCode).toBe(400);
    expect(over.response.json()).toMatchObject({
      code: SHOP_API_ERROR_CODES.VALIDATION,
      message: `Move at most ${MOVE_BATCH_MAX} artworks at a time.`,
    });
    expect(over.stockLocations.moveArtworks).not.toHaveBeenCalled();
  });

  it("counts repeats once toward the limit", async () => {
    const repeated = [...ids(MOVE_BATCH_MAX), ...ids(MOVE_BATCH_MAX)];
    const { response } = await move({ registerIds: repeated, locationId: LOCATION_ID });
    expect(response.statusCode).toBe(200);
  });

  it.each([
    ["no artworks", { registerIds: [], locationId: LOCATION_ID }],
    ["an id that is not a uuid", { registerIds: ["LAX-ORI-1"], locationId: LOCATION_ID }],
    ["no location", { registerIds: [REGISTER_ID] }],
  ])("refuses %s", async (_label, payload) => {
    const { response, stockLocations } = await move(payload);
    expect(response.statusCode).toBe(400);
    expect(stockLocations.moveArtworks).not.toHaveBeenCalled();
  });

  it("refuses more ids than the route's body schema allows, even one artwork repeated", async () => {
    // The batch rule counts a repeat once, so only the body schema refuses this.
    const { response, stockLocations } = await move({
      registerIds: Array(401).fill(REGISTER_ID),
      locationId: LOCATION_ID,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.VALIDATION });
    expect(stockLocations.moveArtworks).not.toHaveBeenCalled();
  });

  it("passes the service's field issues through in the 400 body", async () => {
    const { app, stockLocations } = await buildApp("shop_admin");
    vi.mocked(stockLocations.addLocation).mockRejectedValue(
      new FieldValidationError([
        { field: "name", message: "Give the location a name." },
        { field: "note", message: "Keep the note to 200 characters or fewer." },
      ]),
    );
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/artwork-locations",
      headers,
      payload: { name: " ", note: "x".repeat(201) },
    });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: SHOP_API_ERROR_CODES.VALIDATION,
      issues: [
        { field: "name", message: "Give the location a name." },
        { field: "note", message: "Keep the note to 200 characters or fewer." },
      ],
    });
  });

  it("needs an Idempotency-Key, as other LAX Admin writes do", async () => {
    const { response, stockLocations } = await move(
      { registerIds: [REGISTER_ID], locationId: LOCATION_ID },
      { authorization: `Bearer ${TOKEN}` },
    );
    expect(response.statusCode).toBe(400);
    expect(stockLocations.moveArtworks).not.toHaveBeenCalled();
  });

  it("takes the longest name and note in four-byte characters", async () => {
    const { app, stockLocations } = await buildApp("shop_admin");
    const payload = { name: "🖼".repeat(80), note: "🖼".repeat(200) };
    const added = await app.inject({
      method: "POST",
      url: "/admin/v1/artwork-locations",
      headers,
      payload,
    });
    const renamed = await app.inject({
      method: "PATCH",
      url: `/admin/v1/artwork-locations/${LOCATION_ID}`,
      headers,
      payload: { ...payload, expectedVersion: 1 },
    });
    await app.close();
    expect(added.statusCode, added.body).toBe(200);
    expect(renamed.statusCode, renamed.body).toBe(200);
    expect(stockLocations.addLocation).toHaveBeenCalledOnce();
  });

  it("needs an Idempotency-Key to change the list", async () => {
    const { app, stockLocations } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/artwork-locations",
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { name: "Framer" },
    });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(stockLocations.addLocation).not.toHaveBeenCalled();
  });
});

describe("an artwork's location", () => {
  it("is not found when the artwork is not on the register", async () => {
    const { app, stockLocations } = await buildApp("catalogue_editor");
    stockLocations.artworkLocation.mockResolvedValueOnce(null);
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/artwork-register/${REGISTER_ID}/location`,
      headers,
    });
    await app.close();
    expect(response.statusCode).toBe(404);
  });

  it("reads the current location, its label and the history", async () => {
    const { app } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "GET",
      url: `/admin/v1/artwork-register/${REGISTER_ID}/location`,
      headers,
    });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(artworkLocation);
  });
});
