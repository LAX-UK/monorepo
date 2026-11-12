import type { DocumentKind, LegalEntity } from "@auction/accounting-domain";
import { KIND_SPECS } from "../adapter/kinds.js";
import type { ZohoOrgConfig, ZohoOrgConfigs } from "../adapter/org-config.js";
import type { TransportRequest, TransportResponse, ZohoTransport } from "../ports.js";
import { FaultQueue } from "./faults.js";
import { DUPLICATE_ZOHO_CODE, TEST_TAX_RATES_BPS } from "./org-fixtures.js";

type Json = Record<string, unknown>;

interface Stored {
  readonly id: string;
  readonly kind: DocumentKind;
  readonly reference: string;
  readonly record: Json;
}

const PATH_KINDS = new Map<string, DocumentKind>(
  (Object.keys(KIND_SPECS) as DocumentKind[]).map((k) => [KIND_SPECS[k].path, k]),
);
const NUMBER_PREFIX: Record<DocumentKind, string> = {
  invoice: "INV",
  credit_note: "CN",
  payment: "PMT",
  bill: "BILL",
  contact: "CON",
};

const reply = (status: number, body: unknown): TransportResponse => ({
  status,
  headers: {},
  body: JSON.stringify(body),
});
const failure = (status: number, code: number, message = "failed") =>
  reply(status, { code, message });

const pence = (pounds: number) => Math.round(pounds * 100);
const pounds = (p: number) => p / 100;
const halfUp = (numerator: number, denominator: number) =>
  Math.floor((2 * numerator + denominator) / (2 * denominator));

/**
 * A stand-in for the Books API at the HTTP edge, driven through the real client and adapter. It
 * keeps documents per organisation, refuses a second document with the same LAX reference, works
 * tax out per line as Books does, and can be told to misbehave (`faults`). It is what the adapter
 * contract runs against instead of the live service: no network, synthetic ids.
 */
export class SimulatedBooks implements ZohoTransport {
  readonly faults = new FaultQueue();
  /** Every API request that reached it, for assertions on what the adapter sent. */
  readonly requests: TransportRequest[] = [];
  private readonly docs = new Map<string, Stored[]>();
  private counter = 5_000_000_000_000;
  private readonly numbers = new Map<string, number>();

  constructor(private readonly orgs: ZohoOrgConfigs) {}

  async send(request: TransportRequest): Promise<TransportResponse> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/oauth/v2/token")) {
      return reply(200, {
        access_token: "simulated-access-token",
        expires_in: 3600,
        api_domain: "https://www.zohoapis.eu",
        token_type: "Bearer",
      });
    }
    this.requests.push(request);
    const org = this.orgByOrganizationId(url.searchParams.get("organization_id"));
    if (!org) return failure(400, 1002, "bad organisation");
    const path = url.pathname.replace(/^\/api\/v3/, "");
    const [, collection, id] = path.split("/");
    const kind = PATH_KINDS.get(`/${collection}`);
    if (!kind) return failure(404, 1002);
    const body: Json | null = request.body ? (JSON.parse(request.body) as Json) : null;
    switch (request.method) {
      case "GET":
        return id ? this.detail(org, kind, id) : this.list(org, kind, url.searchParams);
      case "POST":
        return this.create(org, kind, body ?? {}, url.searchParams);
      case "PUT":
        return id ? this.update(org, kind, id, body ?? {}) : failure(400, 1);
      default:
        return failure(405, 1);
    }
  }

  /** Documents held for an entity's organisation, for assertions. */
  stored(entity: LegalEntity, kind: DocumentKind): readonly Json[] {
    const org = this.orgs[entity];
    return (this.docs.get(org?.organizationId ?? "") ?? [])
      .filter((d) => d.kind === kind)
      .map((d) => d.record);
  }

  private orgByOrganizationId(id: string | null): ZohoOrgConfig | undefined {
    return Object.values(this.orgs).find((o) => o?.organizationId === id);
  }

  private held(org: ZohoOrgConfig, kind: DocumentKind): Stored[] {
    return (this.docs.get(org.organizationId) ?? []).filter((d) => d.kind === kind);
  }

  private list(org: ZohoOrgConfig, kind: DocumentKind, query: URLSearchParams): TransportResponse {
    const wanted = query.get(org.laxReferenceField.apiName);
    const perPage = Number(query.get("per_page") ?? 200);
    const rows = this.held(org, kind)
      .filter((d) => wanted === null || d.reference === wanted)
      .slice(0, perPage)
      .map((d) => ({ [KIND_SPECS[kind].idField]: d.id }));
    return reply(200, { code: 0, message: "success", [KIND_SPECS[kind].listKey]: rows });
  }

  private detail(org: ZohoOrgConfig, kind: DocumentKind, id: string): TransportResponse {
    const found = this.held(org, kind).find((d) => d.id === id);
    if (!found) return failure(404, 1002, "does not exist");
    return reply(200, { code: 0, message: "success", [KIND_SPECS[kind].itemKey]: found.record });
  }

  private update(
    org: ZohoOrgConfig,
    kind: DocumentKind,
    id: string,
    body: Json,
  ): TransportResponse {
    const found = this.held(org, kind).find((d) => d.id === id);
    if (!found || kind !== "contact") return failure(404, 1002);
    Object.assign(found.record, { contact_name: body.contact_name });
    return reply(200, { code: 0, message: "updated", [KIND_SPECS[kind].itemKey]: found.record });
  }

  private create(
    org: ZohoOrgConfig,
    kind: DocumentKind,
    body: Json,
    query: URLSearchParams,
  ): TransportResponse {
    const fault = this.faults.take();
    if (fault === "rate_limited") return reply(429, { code: 45 });
    if (fault === "locked_period") return failure(400, 4151, "transaction date is locked");

    const reference = this.referenceOf(org, body);
    if (!reference) return failure(400, 1, "LAX reference missing");
    if (this.held(org, kind).some((d) => d.reference === reference)) {
      return failure(400, DUPLICATE_ZOHO_CODE, "duplicate value");
    }
    const priced = this.price(org, kind, body, query);
    if ("error" in priced) return priced.error;
    const id = String(++this.counter);
    const seq = (this.numbers.get(`${org.organizationId}:${kind}`) ?? 0) + 1;
    this.numbers.set(`${org.organizationId}:${kind}`, seq);
    const number = `${NUMBER_PREFIX[kind]}-${String(seq).padStart(6, "0")}`;
    const spec = KIND_SPECS[kind];
    const drift = fault === "totals_drift" ? 1 : 0;
    const record: Json = {
      ...priced.fields,
      [spec.idField]: id,
      ...(spec.numberField ? { [spec.numberField]: number } : {}),
      custom_field_hash: { [org.laxReferenceField.apiName]: reference },
    };
    if (drift && typeof record.total === "number") {
      record.tax_total = pounds(pence(record.tax_total as number) + drift);
      record.total = pounds(pence(record.total as number) + drift);
    }
    const all = this.docs.get(org.organizationId) ?? [];
    all.push({ id, kind, reference, record });
    this.docs.set(org.organizationId, all);
    if (fault === "timeout_after_commit") throw new Error("ECONNRESET");
    return reply(201, { code: 0, message: "created", [spec.itemKey]: record });
  }

  private referenceOf(org: ZohoOrgConfig, body: Json): string | null {
    const fields = body.custom_fields;
    if (!Array.isArray(fields)) return null;
    const field = fields.find((f) => (f as Json).customfield_id === org.laxReferenceField.fieldId);
    const value = (field as Json | undefined)?.value;
    return typeof value === "string" ? value : null;
  }

  private exists(org: ZohoOrgConfig, kind: DocumentKind, id: unknown): boolean {
    return this.held(org, kind).some((d) => d.id === id);
  }

  /** What Books works out for a document: totals per line for priced ones, the amount for a payment. */
  private price(
    org: ZohoOrgConfig,
    kind: DocumentKind,
    body: Json,
    query: URLSearchParams,
  ): { fields: Json } | { error: TransportResponse } {
    const party = kind === "bill" ? body.vendor_id : body.customer_id;
    if (kind === "contact") return { fields: { contact_name: body.contact_name } };
    if (!this.exists(org, "contact", party))
      return { error: failure(400, 1003, "no such contact") };
    if (kind === "payment") return this.pricePayment(org, body);
    if (kind === "credit_note" && !this.exists(org, "invoice", query.get("invoice_id"))) {
      return { error: failure(400, 1004, "no such invoice") };
    }
    const inclusive = body.is_inclusive_tax === true;
    let net = 0;
    let vat = 0;
    let gross = 0;
    for (const raw of (body.line_items ?? []) as Json[]) {
      const amount = pence((raw.rate as number) * (raw.quantity as number));
      const bps = raw.tax_id === undefined ? 0 : (TEST_TAX_RATES_BPS[raw.tax_id as string] ?? 0);
      const lineVat = inclusive ? halfUp(amount * bps, 10_000 + bps) : halfUp(amount * bps, 10_000);
      vat += lineVat;
      if (inclusive) gross += amount;
      else {
        net += amount;
        gross += amount + lineVat;
      }
    }
    return {
      fields: {
        sub_total: pounds(inclusive ? gross : net),
        tax_total: pounds(vat),
        total: pounds(gross),
      },
    };
  }

  private pricePayment(
    org: ZohoOrgConfig,
    body: Json,
  ): { fields: Json } | { error: TransportResponse } {
    const amount = pence(body.amount as number);
    let applied = 0;
    for (const raw of (body.invoices ?? []) as Json[]) {
      if (!this.exists(org, "invoice", raw.invoice_id)) {
        return { error: failure(400, 1004, "no such invoice") };
      }
      applied += pence(raw.amount_applied as number);
    }
    if (applied > amount) return { error: failure(400, 1005, "applied more than the amount") };
    return { fields: { amount: pounds(amount) } };
  }
}
