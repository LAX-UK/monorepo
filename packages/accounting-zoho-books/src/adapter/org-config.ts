import {
  LEGAL_ENTITIES,
  LINE_ROLES,
  type LegalEntity,
  type LineRole,
  VAT_TREATMENTS,
  type VatTreatment,
} from "@auction/accounting-domain";
import { ZohoBooksConfigError } from "../config.js";

/**
 * Everything the mappers need to know about one Books organisation. The accountant owns these
 * values (chart of accounts, tax codes, items, numbering, templates); nothing here is hard-coded in
 * a mapper. The shape is checked once, at start-up, by `parseOrgConfigs`.
 */
/**
 * Whether a Books organisation holds the company's real books (`live`) or is a rehearsal copy
 * (`test`). Stated per organisation with no default, and checked by the write gate: a `test_org`
 * adapter can only write to a `test` organisation, a `live` one only to a `live` organisation.
 */
export const ORG_ENVIRONMENTS = ["test", "live"] as const;
export type ZohoOrgEnvironment = (typeof ORG_ENVIRONMENTS)[number];

export interface ZohoOrgConfig {
  /** The Books organisation (one per legal entity). */
  readonly organizationId: string;
  /** A rehearsal organisation or the real books; the write gate binds each write mode to one. */
  readonly environment: ZohoOrgEnvironment;
  /** The custom field that Books refuses to accept twice, carrying the LAX reference. */
  readonly laxReferenceField: {
    /** Id used when writing the value. */
    readonly fieldId: string;
    /** API name used when searching, `cf_` followed by lower-case letters, digits and `_`. */
    readonly apiName: string;
  };
  /**
   * Zoho codes a create is refused with when the LAX reference already exists. A create refused
   * with one of these is looked up and adopted instead of failing. Confirm in the test organisation.
   */
  readonly duplicateValueZohoCodes: readonly number[];
  /**
   * Whether the legal entity is registered for VAT. A fact the owners and accountant state per
   * organisation; there is no default. When false, no tax id is configured or ever sent, and any
   * line that carries VAT (or claims the standard rate) is refused before anything is posted.
   */
  readonly vatRegistered: boolean;
  /**
   * The Books tax per VAT treatment; `null` means no tax id is sent. A registered organisation must
   * have one for `standard`; an unregistered one must have none at all.
   */
  readonly taxIds: Readonly<Record<VatTreatment, string | null>>;
  /** The item and revenue account every line of a role is posted to. */
  readonly lines: Readonly<
    Record<LineRole, { readonly itemId: string; readonly accountId: string }>
  >;
  readonly payments: {
    /** The "Stripe clearing" bank-type account customer payments are deposited into. */
    readonly depositAccountId: string;
    /** Books' payment mode name for money received through Stripe. */
    readonly paymentMode: string;
  };
  readonly bills: {
    /** The expense account seller payouts are billed to. */
    readonly accountId: string;
  };
  /** Optional PDF templates. */
  readonly templateIds: {
    readonly invoice?: string;
    readonly creditNote?: string;
  };
  /** Optional automatic numbering groups, so Books numbers each series the way the accountant set it. */
  readonly numberSeriesIds: {
    readonly invoice?: string;
    readonly creditNote?: string;
  };
}

export type ZohoOrgConfigs = Readonly<Partial<Record<LegalEntity, ZohoOrgConfig>>>;

const ID = /^[0-9]{5,32}$/;
const API_NAME = /^cf_[a-z][a-z0-9_]{0,63}$/;
const PAYMENT_MODE = /^[A-Za-z][A-Za-z0-9 _-]{0,49}$/;

type Raw = Readonly<Record<string, unknown>>;

function fail(path: string, why: string): never {
  throw new ZohoBooksConfigError(`org_${path}_${why}`);
}

function record(value: unknown, path: string): Raw {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "missing");
  return value as Raw;
}

function id(value: unknown, path: string): string {
  if (typeof value !== "string" || !ID.test(value)) fail(path, "invalid");
  return value;
}

function optionalId(value: unknown, path: string): string | undefined {
  return value === undefined ? undefined : id(value, path);
}

function parseTaxIds(
  value: unknown,
  path: string,
  vatRegistered: boolean,
): Record<VatTreatment, string | null> {
  if (!vatRegistered) {
    // An entity that is not VAT registered has no taxes in Books: nothing may be configured.
    const raw = value === undefined ? {} : record(value, path);
    const out = {} as Record<VatTreatment, string | null>;
    for (const treatment of VAT_TREATMENTS) {
      if (raw[treatment] !== undefined && raw[treatment] !== null) {
        fail(`${path}_${treatment}`, "not_vat_registered");
      }
      out[treatment] = null;
    }
    return out;
  }
  const raw = record(value, path);
  const out = {} as Record<VatTreatment, string | null>;
  for (const treatment of VAT_TREATMENTS) {
    const entry = raw[treatment];
    const at = `${path}_${treatment}`;
    if (entry === null) {
      if (treatment === "standard") fail(at, "required");
      out[treatment] = null;
    } else {
      out[treatment] = id(entry, at);
    }
  }
  return out;
}

function parseLines(value: unknown, path: string): ZohoOrgConfig["lines"] {
  const raw = record(value, path);
  const out = {} as Record<LineRole, { itemId: string; accountId: string }>;
  for (const role of LINE_ROLES) {
    const entry = record(raw[role], `${path}_${role}`);
    out[role] = {
      itemId: id(entry.itemId, `${path}_${role}_item`),
      accountId: id(entry.accountId, `${path}_${role}_account`),
    };
  }
  return out;
}

function parseCodes(value: unknown, path: string): readonly number[] {
  if (!Array.isArray(value) || value.length === 0) fail(path, "missing");
  if (!value.every((c) => Number.isInteger(c) && c > 0)) fail(path, "invalid");
  return [...(value as number[])];
}

function parseOrg(value: unknown, entity: LegalEntity): ZohoOrgConfig {
  const p = entity;
  const raw = record(value, p);
  if (typeof raw.vatRegistered !== "boolean") fail(`${p}_vat_registered`, "missing");
  if (!(ORG_ENVIRONMENTS as readonly unknown[]).includes(raw.environment)) {
    fail(`${p}_environment`, "missing");
  }
  const vatRegistered = raw.vatRegistered;
  const field = record(raw.laxReferenceField, `${p}_reference_field`);
  const apiName = field.apiName;
  if (typeof apiName !== "string" || !API_NAME.test(apiName))
    fail(`${p}_reference_field`, "bad_name");
  const payments = record(raw.payments, `${p}_payments`);
  const mode = payments.paymentMode;
  if (typeof mode !== "string" || !PAYMENT_MODE.test(mode)) fail(`${p}_payment_mode`, "invalid");
  const templates = raw.templateIds === undefined ? {} : record(raw.templateIds, `${p}_templates`);
  const series =
    raw.numberSeriesIds === undefined ? {} : record(raw.numberSeriesIds, `${p}_series`);
  const optional = <T extends string>(src: Raw, key: T, path: string) => {
    const v = optionalId(src[key], `${p}_${path}_${key}`);
    return v === undefined ? {} : { [key]: v };
  };
  return {
    organizationId: id(raw.organizationId, `${p}_organization`),
    environment: raw.environment as ZohoOrgEnvironment,
    laxReferenceField: { fieldId: id(field.fieldId, `${p}_reference_field_id`), apiName },
    duplicateValueZohoCodes: parseCodes(raw.duplicateValueZohoCodes, `${p}_duplicate_codes`),
    vatRegistered,
    taxIds: parseTaxIds(raw.taxIds, `${p}_tax`, vatRegistered),
    lines: parseLines(raw.lines, `${p}_lines`),
    payments: {
      depositAccountId: id(payments.depositAccountId, `${p}_deposit_account`),
      paymentMode: mode,
    },
    bills: { accountId: id(record(raw.bills, `${p}_bills`).accountId, `${p}_bill_account`) },
    templateIds: {
      ...optional(templates, "invoice", "template"),
      ...optional(templates, "creditNote", "template"),
    },
    numberSeriesIds: {
      ...optional(series, "invoice", "series"),
      ...optional(series, "creditNote", "series"),
    },
  };
}

/**
 * Read the per-organisation settings from plain data (for example JSON from the environment) and
 * refuse anything incomplete, so a missing id is found when the process starts rather than on the
 * first invoice. An entity may be left out (the Bid organisation does not exist yet); a document for
 * it is then refused with a clear reason. Each organisation must say whether it is VAT registered
 * and whether it is a test or the live organisation: the parser never assumes either answer. Two entities may never share one Books organisation.
 */
export function parseOrgConfigs(input: unknown): ZohoOrgConfigs {
  const raw = record(input, "configs");
  for (const key of Object.keys(raw)) {
    if (!(LEGAL_ENTITIES as readonly string[]).includes(key)) fail("configs", "unknown_entity");
  }
  const out: Partial<Record<LegalEntity, ZohoOrgConfig>> = {};
  for (const entity of LEGAL_ENTITIES) {
    if (raw[entity] !== undefined) out[entity] = parseOrg(raw[entity], entity);
  }
  const orgs = Object.values(out).map((c) => c.organizationId);
  if (new Set(orgs).size !== orgs.length) fail("configs", "shared_organization");
  if (orgs.length === 0) fail("configs", "empty");
  return out;
}
