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
const PARTY_ID = "22222222-2222-4222-8222-222222222222";
const AGREEMENT_ID = "11111111-1111-4111-8111-111111111111";
const KEY = "agreement-key-0001";
const FILE_KEY = `private/consignor-agreements/${PARTY_ID}/33333333-3333-4333-8333-333333333333.pdf`;

/**
 * Who may do what. Reading comes with reading clients (a broker only for assigned clients);
 * keeping agreements is for Administrators and Catalogue editors.
 */
const CAN_READ: ShopStaffRole[] = ["shop_admin", "account_manager", "catalogue_editor"];
const CAN_MANAGE: ShopStaffRole[] = ["shop_admin", "catalogue_editor"];

const agreement = {
  id: AGREEMENT_ID,
  agreementId: AGREEMENT_ID,
  version: 1,
  partyId: PARTY_ID,
  places: ["lax_bid", "lax_art"],
  startsOn: "2026-03-03",
  endsOn: "2027-03-02",
  lowestPricePence: 200_000,
  commissionBasisPoints: 2500,
  signedFileKey: FILE_KEY,
  note: null,
  status: "current",
  replacesId: null,
  createdAt: "2026-03-03T10:00:00.000Z",
  replacedAt: null,
  retiredAt: null,
};
const list = { party: { partyId: PARTY_ID, displayName: "Ivo Marren" }, items: [agreement] };
const terms = {
  places: ["lax_bid"],
  startsOn: "2026-03-03",
  endsOn: null,
  lowestPricePence: null,
  commissionBasisPoints: 2500,
  signedFileKey: FILE_KEY,
  note: "Signed at the gallery",
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function buildApp(
  role: ShopStaffRole,
  options: { authTime?: number; assigned?: boolean } = {},
) {
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
      brokerCanAccessClientParty: async () => options.assigned === true,
    },
  });
  const consignorAgreements = {
    list: vi.fn(async (): Promise<typeof list | null> => list),
    createFileUpload: vi.fn(async () => ({
      key: FILE_KEY,
      uploadUrl: "https://storage.test/put",
      requiredHeaders: { "content-type": "application/pdf" },
    })),
    fileLink: vi.fn(async () => ({
      url: "https://storage.test/get",
      expiresAt: "2026-11-17T09:05:00.000Z",
    })),
    add: vi.fn(async () => agreement),
    replace: vi.fn(async () => ({ ...agreement, version: 2 })),
    retire: vi.fn(async () => ({ ...agreement, status: "retired" })),
  };
  deps.admin.consignorAgreements = consignorAgreements as never;
  deps.admin.staffReader = {
    ...deps.admin.staffReader,
    brokerCanAccessClientParty: async () => options.assigned === true,
  };
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, consignorAgreements };
}

const headers = { authorization: `Bearer ${TOKEN}`, "idempotency-key": KEY };
const base = `/admin/v1/clients/${PARTY_ID}/consignor-agreements`;

type Probe = {
  name: string;
  method: "GET" | "POST";
  url: string;
  payload?: Record<string, unknown>;
  allowed: ShopStaffRole[];
  call: keyof Awaited<ReturnType<typeof buildApp>>["consignorAgreements"];
};

const PROBES: Probe[] = [
  { name: "list agreements", method: "GET", url: base, allowed: CAN_READ, call: "list" },
  {
    name: "open a signed file",
    method: "GET",
    url: `${base}/versions/${AGREEMENT_ID}/file`,
    allowed: CAN_READ,
    call: "fileLink",
  },
  {
    name: "upload a signed file",
    method: "POST",
    url: `/admin/v1/clients/${PARTY_ID}/consignor-agreement-uploads`,
    payload: { contentType: "application/pdf", byteSize: 2048 },
    allowed: CAN_MANAGE,
    call: "createFileUpload",
  },
  {
    name: "add an agreement",
    method: "POST",
    url: base,
    payload: terms,
    allowed: CAN_MANAGE,
    call: "add",
  },
  {
    name: "replace an agreement",
    method: "POST",
    url: `${base}/${AGREEMENT_ID}/replace`,
    payload: { expectedVersion: 1, ...terms },
    allowed: CAN_MANAGE,
    call: "replace",
  },
  {
    name: "retire an agreement",
    method: "POST",
    url: `${base}/${AGREEMENT_ID}/retire`,
    payload: { expectedVersion: 1 },
    allowed: CAN_MANAGE,
    call: "retire",
  },
];

async function send(probe: Probe, app: Awaited<ReturnType<typeof buildApp>>["app"]) {
  return app.inject({
    method: probe.method,
    url: probe.url,
    headers,
    ...(probe.payload ? { payload: probe.payload } : {}),
  });
}

describe("consignor agreement routes: who may do what", () => {
  const cases = PROBES.flatMap((probe) =>
    SHOP_STAFF_ROLES.map((role) => ({ probe, role, allowed: probe.allowed.includes(role) })),
  );

  it.each(cases)("$probe.name as $role → allowed: $allowed", async ({ probe, role, allowed }) => {
    const { app, consignorAgreements } = await buildApp(role);
    const response = await send(probe, app);
    await app.close();
    if (allowed) {
      expect(response.statusCode, response.body).toBe(200);
      expect(consignorAgreements[probe.call]).toHaveBeenCalledOnce();
    } else {
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe(SHOP_API_ERROR_CODES.FORBIDDEN);
      expect(consignorAgreements[probe.call]).not.toHaveBeenCalled();
    }
  });

  it("lets a broker read the agreements of a client assigned to them, and no other", async () => {
    for (const assigned of [true, false]) {
      const { app, consignorAgreements } = await buildApp("broker", { assigned });
      const response = await app.inject({ method: "GET", url: base, headers });
      await app.close();
      expect(response.statusCode).toBe(assigned ? 200 : 403);
      expect(consignorAgreements.list).toHaveBeenCalledTimes(assigned ? 1 : 0);
    }
  });

  it("answers 404 for a party that is not a client", async () => {
    const { app, consignorAgreements } = await buildApp("shop_admin");
    consignorAgreements.list.mockResolvedValue(null);
    const response = await app.inject({ method: "GET", url: base, headers });
    await app.close();
    expect(response.statusCode).toBe(404);
  });
});

describe("changing agreements needs a recent sign-in", () => {
  const stale = () => nowSeconds() - 24 * 60 * 60;
  const writes = PROBES.filter((probe) => ["add", "replace", "retire"].includes(probe.call));

  it.each(writes)("$name is refused for a keeper who signed in long ago", async (probe) => {
    const { app, consignorAgreements } = await buildApp("catalogue_editor", {
      authTime: stale(),
    });
    const response = await send(probe, app);
    await app.close();
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe(SHOP_API_ERROR_CODES.STEP_UP_REQUIRED);
    expect(consignorAgreements[probe.call]).not.toHaveBeenCalled();
    expect(isStepUpPath(new URL(probe.url, "http://x").pathname)).toBe(true);
  });

  it("lets a keeper upload the file and read without signing in again", async () => {
    for (const probe of PROBES.filter((p) => !writes.includes(p))) {
      const { app } = await buildApp("shop_admin", { authTime: stale() });
      const response = await send(probe, app);
      await app.close();
      expect(response.statusCode, probe.name).toBe(200);
    }
    // The BFF asks for a recent sign-in on writes under the step-up paths; the upload is outside.
    expect(isStepUpPath(`/admin/v1/clients/${PARTY_ID}/consignor-agreement-uploads`)).toBe(false);
    for (const probe of PROBES.filter((p) => p.method === "POST" && p.call !== "createFileUpload"))
      expect(isStepUpPath(new URL(probe.url, "http://x").pathname), probe.name).toBe(true);
  });
});

describe("agreement writes", () => {
  it("passes the terms, the actor and the key to the service", async () => {
    const { app, consignorAgreements } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "POST",
      url: `${base}/${AGREEMENT_ID}/replace`,
      headers,
      payload: { expectedVersion: 1, ...terms },
    });
    await app.close();
    expect(response.statusCode).toBe(200);
    expect(consignorAgreements.replace).toHaveBeenCalledWith({
      actorSubjectId: "catalogue_editor-subject",
      idempotencyKey: KEY,
      partyId: PARTY_ID,
      agreementId: AGREEMENT_ID,
      expectedVersion: 1,
      terms,
    });
  });

  it("needs an Idempotency-Key", async () => {
    const { app, consignorAgreements } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "POST",
      url: base,
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: terms,
    });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(consignorAgreements.add).not.toHaveBeenCalled();
  });

  it.each([
    ["no places", { ...terms, places: [] }],
    ["an unknown place", { ...terms, places: ["zoho"] }],
    ["a commission over 100%", { ...terms, commissionBasisPoints: 10_001 }],
    ["a price in pounds", { ...terms, lowestPricePence: 20.5 }],
  ])("refuses %s before reaching the service", async (_label, payload) => {
    const { app, consignorAgreements } = await buildApp("shop_admin");
    const response = await app.inject({ method: "POST", url: base, headers, payload });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(consignorAgreements.add).not.toHaveBeenCalled();
  });

  it("refuses a file that is not a PDF, JPEG or PNG before asking for an upload", async () => {
    const { app, consignorAgreements } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/clients/${PARTY_ID}/consignor-agreement-uploads`,
      headers,
      payload: { contentType: "text/html", byteSize: 10 },
    });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(consignorAgreements.createFileUpload).not.toHaveBeenCalled();
  });

  it("passes the service's field issues through in the 400 body", async () => {
    const { app, consignorAgreements } = await buildApp("shop_admin");
    consignorAgreements.add.mockRejectedValue(
      new FieldValidationError([
        { field: "endsOn", message: "The end date must be on or after the start date." },
        { field: "signedFileKey", message: "Upload the signed agreement." },
      ]),
    );
    const response = await app.inject({ method: "POST", url: base, headers, payload: terms });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: SHOP_API_ERROR_CODES.VALIDATION,
      message: "The end date must be on or after the start date.",
      issues: [
        { field: "endsOn", message: "The end date must be on or after the start date." },
        { field: "signedFileKey", message: "Upload the signed agreement." },
      ],
    });
  });
});
