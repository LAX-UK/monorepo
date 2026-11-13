import { describe, expect, it } from "vitest";
import { ZohoBooksConfigError } from "../config.js";
import { rawOrgSettings } from "../testing/index.js";
import { parseOrgConfigs } from "./org-config.js";

type Raw = Record<string, Record<string, unknown>>;

function raw(): Raw {
  return structuredClone(rawOrgSettings()) as Raw;
}

/** Set a value at a path inside one organisation's settings (undefined removes it). */
function setAt(input: Raw, path: readonly string[], value: unknown): void {
  let node: Record<string, unknown> = input.london_art_exchange as Record<string, unknown>;
  for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[path[path.length - 1] as string] = value;
}

function codeOf(input: unknown): string {
  try {
    parseOrgConfigs(input);
  } catch (error) {
    if (error instanceof ZohoBooksConfigError) return error.code;
    throw error;
  }
  return "accepted";
}

describe("per-organisation config", () => {
  it("accepts complete settings for both organisations", () => {
    const configs = parseOrgConfigs(raw());
    expect(configs.london_art_exchange?.laxReferenceField.apiName).toBe("cf_lax_reference");
    expect(configs.london_auction_xchange?.organizationId).toBe("9000000000002");
  });

  it("accepts one organisation alone, because the Bid organisation may not exist yet", () => {
    const input = raw();
    // biome-ignore lint/performance/noDelete: building a partial fixture
    delete input.london_auction_xchange;
    expect(Object.keys(parseOrgConfigs(input))).toEqual(["london_art_exchange"]);
  });

  it("refuses an empty or unknown entity set", () => {
    expect(codeOf({})).toBe("org_configs_empty");
    expect(codeOf({ somebody_else: {} })).toBe("org_configs_unknown_entity");
    expect(codeOf(null)).toBe("org_configs_missing");
  });

  it("refuses two entities that share one Books organisation", () => {
    const input = raw();
    (input.london_auction_xchange as Record<string, unknown>).organizationId = "9000000000001";
    expect(codeOf(input)).toBe("org_configs_shared_organization");
  });

  it("refuses a VAT-registered organisation with no standard tax id, but allows none for exempt", () => {
    const input = raw();
    (
      (input.london_auction_xchange as Record<string, unknown>).taxIds as Record<string, unknown>
    ).standard = null;
    expect(codeOf(input)).toBe("org_london_auction_xchange_tax_standard_required");
  });

  it("requires every organisation to state whether it is VAT registered, with no default", () => {
    for (const value of [undefined, "no", 0, null]) {
      const input = raw();
      setAt(input, ["vatRegistered"], value);
      expect(codeOf(input)).toBe("org_london_art_exchange_vat_registered_missing");
    }
  });

  it("requires every organisation to say whether it is a test or the live organisation", () => {
    for (const value of [undefined, "prod", "LIVE", true, null]) {
      const input = raw();
      setAt(input, ["environment"], value);
      expect(codeOf(input)).toBe("org_london_art_exchange_environment_missing");
    }
    expect(parseOrgConfigs(raw()).london_art_exchange?.environment).toBe("test");
  });

  it("reads London Art Exchange as not VAT registered, with no tax ids at all", () => {
    const shop = parseOrgConfigs(raw()).london_art_exchange;
    expect(shop?.vatRegistered).toBe(false);
    expect(Object.values(shop?.taxIds ?? {}).every((t) => t === null)).toBe(true);
  });

  it("refuses a tax id for an organisation that is not VAT registered", () => {
    const input = raw();
    setAt(input, ["taxIds"], { standard: "9110000000001" });
    expect(codeOf(input)).toBe("org_london_art_exchange_tax_standard_not_vat_registered");
    const zero = raw();
    setAt(zero, ["taxIds"], { zero: "9110000000002", standard: null });
    expect(codeOf(zero)).toBe("org_london_art_exchange_tax_zero_not_vat_registered");
  });

  it("refuses ids that are not Books ids", () => {
    const input = raw();
    (input.london_art_exchange as Record<string, unknown>).organizationId = "not-an-id";
    expect(codeOf(input)).toBe("org_london_art_exchange_organization_invalid");
  });

  it("refuses a missing item, account, deposit or bill account", () => {
    const cases: [string[], unknown, string][] = [
      [["lines", "goods", "itemId"], undefined, "org_london_art_exchange_lines_goods_item_invalid"],
      [
        ["lines", "delivery", "accountId"],
        "x",
        "org_london_art_exchange_lines_delivery_account_invalid",
      ],
      [
        ["payments", "depositAccountId"],
        undefined,
        "org_london_art_exchange_deposit_account_invalid",
      ],
      [["bills"], {}, "org_london_art_exchange_bill_account_invalid"],
    ];
    for (const [path, value, code] of cases) {
      const input = raw();
      setAt(input, path, value);
      expect(codeOf(input)).toBe(code);
    }
  });

  it("refuses a reference field name that is not a custom field name, and missing duplicate codes", () => {
    const a = raw();
    setAt(a, ["laxReferenceField", "apiName"], "lax_reference");
    expect(codeOf(a)).toBe("org_london_art_exchange_reference_field_bad_name");
    const b = raw();
    setAt(b, ["duplicateValueZohoCodes"], []);
    expect(codeOf(b)).toBe("org_london_art_exchange_duplicate_codes_missing");
  });

  it("refuses an optional template or series id that is not an id", () => {
    const input = raw();
    setAt(input, ["templateIds", "invoice"], "tpl");
    expect(codeOf(input)).toBe("org_london_art_exchange_template_invoice_invalid");
  });
});
