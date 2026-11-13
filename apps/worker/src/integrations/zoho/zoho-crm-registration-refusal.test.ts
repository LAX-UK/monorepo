import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { classifyDeliveryError, formatDeliveryError } from "../../lib/delivery-retry.js";
import { mapDomainEventToCrmIntent } from "../crm/crm-event-mappers.js";
import { CRM_FIELD } from "../crm/crm-field-constants.js";
import { CrmGatewayError } from "../crm/crm-gateway-error.js";
import { InMemoryCrmLinkRepo } from "../crm/crm-test-doubles.js";
import { CrmPersonSyncHandler } from "../crm/handlers/crm-person-sync-handler.js";
import { ZohoCrmGatewayCrmErrorAdapter } from "./zoho-crm-gateway-crm-error-adapter.js";
import { ZohoCrmGateway } from "./zoho-crm-gateway.js";

vi.mock("./oauth-token-refresh.js", () => ({
  getZohoCrmAccessToken: vi.fn().mockResolvedValue("token-abc"),
  invalidateZohoCrmAccessToken: vi.fn(),
}));

const API_HOST = "https://sandbox.zohoapis.eu";

type Sent = { path: string; body: Record<string, unknown> | null };

function respond(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => (body === null ? "" : JSON.stringify(body)),
  } as Response;
}

const SUCCESS = {
  data: [
    { code: "SUCCESS", details: { id: "lead-1" }, message: "record added", status: "success" },
  ],
};

function refused(code: string, apiName: string): unknown {
  return {
    data: [
      {
        code,
        details: { api_name: apiName, json_path: `$.data[0].${apiName}` },
        message: "invalid data",
        status: "error",
      },
    ],
  };
}

/** A fake Zoho: COQL finds nobody; each upsert gets the next queued answer. */
function fakeZoho(upsertAnswers: Array<[number, unknown]>): Sent[] {
  const sent: Sent[] = [];
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    sent.push({ path, body });
    if (path.endsWith("/coql")) return respond(204, null);
    const next = upsertAnswers.shift();
    if (!next) throw new Error(`unexpected request ${path}`);
    return respond(next[0], next[1]);
  });
  return sent;
}

function registration(email = "person@example.test") {
  const intent = mapDomainEventToCrmIntent(
    {
      id: 7,
      eventType: "user.registered",
      aggregateId: "subject-1",
      schemaVersion: 1,
      payload: {
        userId: "subject-1",
        email,
        name: "Ada",
        source: "credential",
      },
    },
    {
      leadStatusNew: "New (Unassigned)",
      auctionPipeline: "",
      dealStageLotWon: "",
      dealStagePaymentCaptured: "",
      dealStagePaymentRefunded: "",
      dealStageShopPaid: "",
    },
  );
  if (intent.kind !== "person_upsert") throw new Error("expected person_upsert");
  return intent;
}

function handler(links: InMemoryCrmLinkRepo, onFieldDropped = vi.fn()) {
  const gateway = new ZohoCrmGatewayCrmErrorAdapter(
    new ZohoCrmGateway({} as WorkerEnv, { apiHost: API_HOST, trigger: [] }),
  );
  return {
    onFieldDropped,
    sync: (email?: string) => {
      const intent = registration(email);
      return new CrmPersonSyncHandler({
        gateway,
        linkRepo: links,
        onFieldDropped,
      }).syncPerson(intent.subjectId, intent.email, intent.fields, "upsert", {
        createOnlyFields: intent.createOnlyFields,
      });
    },
  };
}

const upserts = (sent: Sent[]) => sent.filter((request) => request.path.endsWith("/upsert"));
const firstRecord = (request: Sent) => (request.body?.data as Record<string, unknown>[])[0] ?? {};

describe("user.registered when Zoho refuses the lead", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("always sends a Last_Name, even for a one-word name", () => {
    const intent = registration();
    expect(intent.fields.Last_Name).toBe("Ada");
    expect(intent.fields).not.toHaveProperty("First_Name");
  });

  it("leaves out a picklist value the org refuses and still creates the lead", async () => {
    const sent = fakeZoho([
      [400, refused("INVALID_DATA", CRM_FIELD.leadSource)],
      [200, SUCCESS],
    ]);
    const links = new InMemoryCrmLinkRepo();
    const run = handler(links);

    const result = await run.sync();

    expect(result.outcome).toBe("success");
    const [first, second] = upserts(sent);
    expect(firstRecord(first as Sent)).toHaveProperty(CRM_FIELD.leadSource, "Website");
    expect(firstRecord(second as Sent)).not.toHaveProperty(CRM_FIELD.leadSource);
    expect(firstRecord(second as Sent)).toHaveProperty("Last_Name", "Ada");
    expect(run.onFieldDropped).toHaveBeenCalledWith({
      module: "Leads",
      fieldApiName: CRM_FIELD.leadSource,
      code: "INVALID_DATA",
    });
    expect((await links.findByEntity("subject", "subject-1"))?.zohoRecordId).toBe("lead-1");
  });

  it("leaves out several refused optional fields one after another", async () => {
    const sent = fakeZoho([
      [400, refused("INVALID_DATA", CRM_FIELD.leadStatus)],
      [400, refused("INVALID_DATA", CRM_FIELD.enquiryType)],
      [200, SUCCESS],
    ]);
    const result = await handler(new InMemoryCrmLinkRepo()).sync();
    expect(result.outcome).toBe("success");
    const last = firstRecord(upserts(sent)[2] as Sent);
    expect(last).not.toHaveProperty(CRM_FIELD.leadStatus);
    expect(last).not.toHaveProperty(CRM_FIELD.enquiryType);
    expect(last).toHaveProperty(CRM_FIELD.subjectExternalId, "subject-1");
  });

  it("fails with Zoho's code and field when a field it requires is missing", async () => {
    fakeZoho([[400, refused("MANDATORY_NOT_FOUND", "Signed_up_with")]]);
    const error = await handler(new InMemoryCrmLinkRepo())
      .sync()
      .then(() => null)
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(CrmGatewayError);
    expect(formatDeliveryError(error)).toBe("zoho_crm_http_400:MANDATORY_NOT_FOUND:Signed_up_with");
    expect(classifyDeliveryError(error)).toBe("fatal");
  });

  it("never drops a field the lead cannot do without", async () => {
    const sent = fakeZoho([[400, refused("INVALID_DATA", CRM_FIELD.subjectExternalId)]]);
    const error = await handler(new InMemoryCrmLinkRepo())
      .sync()
      .then(() => null)
      .catch((err: unknown) => err);
    expect(formatDeliveryError(error)).toBe("zoho_crm_http_400:INVALID_DATA:LAX_Subject_ID");
    expect(upserts(sent)).toHaveLength(1);
  });

  it("is safe to retry: every attempt upserts by the platform id, then email", async () => {
    const sent = fakeZoho([
      [400, refused("INVALID_DATA", CRM_FIELD.leadSource)],
      [200, SUCCESS],
      [200, { data: [{ ...SUCCESS.data[0], code: "SUCCESS", message: "record updated" }] }],
    ]);
    const links = new InMemoryCrmLinkRepo();
    const run = handler(links);

    expect((await run.sync()).outcome).toBe("success");
    // A second delivery of the same event (a Retry from Failed jobs) updates the same lead.
    expect((await run.sync()).outcome).toBe("success");

    for (const request of upserts(sent)) {
      expect(request.path).toBe("/crm/v8/Leads/upsert");
      expect(request.body?.duplicate_check_fields).toEqual([CRM_FIELD.subjectExternalId, "Email"]);
    }
    expect(links.rows.size).toBe(1);
    expect((await links.findByEntity("subject", "subject-1"))?.zohoRecordId).toBe("lead-1");
  });
});

/**
 * The nightly Identity acceptance run signs up `<local>+lax-<label>-acceptance-<run>-<attempt>-<job>@
 * <domain>`: with a source mailbox over 16 characters before the `@`, that local part is longer than
 * the 64 characters mail standards allow, and Zoho refuses the Email (all 49 failures on test).
 */
const ACCEPTANCE_SIGN_UP =
  "identity.acceptance+lax-refresh-acceptance-19012345678-1-live-contracts@example.com";

describe("user.registered when Zoho cannot take the email", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("records email_rejected_by_zoho, not a retry, when Zoho refuses the Email value", async () => {
    const sent = fakeZoho([[400, refused("INVALID_DATA", "Email")]]);
    const error = await handler(new InMemoryCrmLinkRepo())
      .sync()
      .then(() => null)
      .catch((err: unknown) => err);

    expect(formatDeliveryError(error)).toBe(
      "email_rejected_by_zoho:zoho_crm_http_400:INVALID_DATA:Email",
    );
    expect(classifyDeliveryError(error)).toBe("fatal");
    expect(upserts(sent)).toHaveLength(1);
    // The refused address is not looked up again after the refusal.
    expect(sent.filter((request) => request.path.endsWith("/coql"))).toHaveLength(2);
  });

  it("does not send an address whose local part is over 64 characters", async () => {
    const sent = fakeZoho([]);
    const links = new InMemoryCrmLinkRepo();

    const result = await handler(links).sync(ACCEPTANCE_SIGN_UP);

    expect(result.outcome).toBe("fatal");
    if (result.outcome !== "fatal") throw new Error("expected fatal");
    expect(formatDeliveryError(result.error)).toBe("email_rejected_by_zoho:local_part_too_long");
    expect(classifyDeliveryError(result.error)).toBe("fatal");
    expect(sent).toHaveLength(0);
    expect(links.rows.size).toBe(0);
  });

  it("sends the address trimmed with its domain in lower case, and a Retry updates the same lead", async () => {
    const sent = fakeZoho([
      [200, SUCCESS],
      [200, { data: [{ ...SUCCESS.data[0], message: "record updated" }] }],
    ]);
    const links = new InMemoryCrmLinkRepo();
    const run = handler(links);

    expect((await run.sync("  Ada.Lovelace+news@Example.COM \n")).outcome).toBe("success");
    expect((await run.sync("  Ada.Lovelace+news@Example.COM \n")).outcome).toBe("success");

    const sentUpserts = upserts(sent);
    expect(sentUpserts).toHaveLength(2);
    for (const request of sentUpserts) {
      expect(firstRecord(request).Email).toBe("Ada.Lovelace+news@example.com");
      expect(request.body?.duplicate_check_fields).toEqual([CRM_FIELD.subjectExternalId, "Email"]);
    }
    const lookups = sent.filter((request) => request.path.endsWith("/coql"));
    for (const lookup of lookups) {
      expect(String(lookup.body?.select_query)).toContain("'Ada.Lovelace+news@example.com'");
    }
    expect(links.rows.size).toBe(1);
    expect((await links.findByEntity("subject", "subject-1"))?.zohoRecordId).toBe("lead-1");
  });
});
