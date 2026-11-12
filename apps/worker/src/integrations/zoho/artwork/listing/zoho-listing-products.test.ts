import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LAX_LISTING_KEYS, LAX_LISTING_LABEL } from "@auction/artwork-register-contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../../../env.js";
import { ZohoCrmGateway } from "../../zoho-crm-gateway.js";
import { ZOHO_LISTING_FIELDS } from "./zoho-listing-fields.js";
import { CrmZohoListingProducts, productListingQuery } from "./zoho-listing-products.js";

vi.mock("../../oauth-token-refresh.js", () => ({
  getZohoCrmAccessToken: vi.fn().mockResolvedValue("token-abc"),
  invalidateZohoCrmAccessToken: vi.fn(),
}));

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, "fixtures", name), "utf8");

/** Field metadata read from the Zoho CRM sandbox after the fields were created there. */
const SANDBOX = JSON.parse(fixture("sandbox-listing-fields.json")) as {
  fields: {
    api_name: string;
    data_type: string;
    pick_list_values: string[] | null;
    profiles: { name: string; permission_type: string }[];
  }[];
};

function respond(status: number, body: string) {
  return { ok: status < 300, status, headers: new Headers(), text: async () => body } as Response;
}

function products() {
  const gateway = new ZohoCrmGateway(
    { ZOHO_CRM_API_HOST: "https://www.zohoapis.eu" } as WorkerEnv,
    {
      apiHost: "https://www.zohoapis.eu",
      trigger: [],
    },
  );
  return new CrmZohoListingProducts(gateway);
}

describe("the Zoho listing fields (sandbox contract)", () => {
  it("are the four fields LAX writes, with the types it writes", () => {
    const types = Object.fromEntries(SANDBOX.fields.map((f) => [f.api_name, f.data_type]));
    expect(types).toEqual({
      [ZOHO_LISTING_FIELDS.value]: "picklist",
      [ZOHO_LISTING_FIELDS.detail]: "text",
      [ZOHO_LISTING_FIELDS.link]: "website",
      [ZOHO_LISTING_FIELDS.updated]: "datetime",
    });
  });

  it("offer every listing LAX sends as a picklist value, except plain Sold", () => {
    const picklist = SANDBOX.fields.find((f) => f.api_name === ZOHO_LISTING_FIELDS.value);
    const missing = LAX_LISTING_KEYS.map((key) => LAX_LISTING_LABEL[key]).filter(
      (label) => !picklist?.pick_list_values?.includes(label),
    );
    // Zoho stores a value outside the list (checked in the sandbox); it is added in Setup.
    expect(missing).toEqual(["Sold"]);
  });

  it("are read-only for every profile but the administrators and the integration", () => {
    for (const field of SANDBOX.fields) {
      const writers = field.profiles
        .filter((p) => p.permission_type === "read_write")
        .map((p) => p.name)
        .sort();
      expect(writers).toEqual(["Administrator", "IT and Integrations"]);
    }
  });
});

describe("CrmZohoListingProducts against Zoho's answers", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("reads the listing of several Products in one COQL query", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond(200, fixture("coql-product-listing.json")));
    const ids = ["1023341000017963001", "1023341000017963002", "1023341000017963003"];
    const states = await products().read(ids);

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({ select_query: productListingQuery(ids) });
    expect(productListingQuery(ids)).toContain("where id in ('1023341000017963001'");
    expect(states.get("1023341000017963001")).toEqual({
      value: "In a LAX Bid sale — live now",
      detail: "Autumn Modern & Contemporary · Lot 12 · live now, ends 14 Nov 2026, 20:00",
      link: "https://lax.bid/lot/harbour-at-dusk/6f1c1d0e-0000-4000-8000-000000000001",
      // Zoho answers in the org user's offset; it is the same instant.
      updatedAt: new Date("2026-11-05T08:30:00Z"),
    });
    expect(states.get("1023341000017963003")).toEqual({
      value: null,
      detail: null,
      link: null,
      updatedAt: null,
    });
  });

  it("sends updates in one request and reads each record's answer in order", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(respond(207, fixture("products-update-207.json")));
    const results = await products().update([
      { productId: "1023341000017963001", fields: { LAX_Listing: "On lax.art" } },
      { productId: "1023341000017963002", fields: { LAX_Listing_Link: "not a url" } },
    ]);

    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toBe("https://www.zohoapis.eu/crm/v8/Products");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({
      data: [
        { id: "1023341000017963001", LAX_Listing: "On lax.art" },
        { id: "1023341000017963002", LAX_Listing_Link: "not a url" },
      ],
      trigger: [],
    });
    expect(results).toEqual([
      { productId: "1023341000017963001", ok: true },
      { productId: "1023341000017963002", ok: false, code: "INVALID_DATA", retryable: false },
    ]);
  });

  it("reports a Product deleted in Zoho as not found, never to be retried", async () => {
    const body = (code: string) =>
      JSON.stringify({ data: [{ code, status: "error", message: "gone", details: {} }] });
    for (const code of ["RECORD_NOT_FOUND", "ID_INVALID"]) {
      vi.mocked(fetch).mockResolvedValueOnce(respond(207, body(code)));
      expect(
        await products().update([{ productId: "1", fields: { LAX_Listing: "On lax.art" } }]),
      ).toEqual([{ productId: "1", ok: false, code: "product_not_found", retryable: false }]);
    }
  });

  it("sends nothing for no updates", async () => {
    expect(await products().update([])).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
