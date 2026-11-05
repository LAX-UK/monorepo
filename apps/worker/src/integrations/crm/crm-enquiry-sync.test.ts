import type { CrmRecordLinkRow, ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import type { WorkerEnv } from "../../env.js";
import { mapDomainEventToCrmIntent } from "./crm-event-mappers.js";
import { CRM_FIELD, CRM_LEAD_SOURCE_BID_PRIVATE_SALE_ENQUIRY } from "./crm-field-constants.js";
import type { CrmGateway } from "./crm-gateway.js";
import type { CrmEnquiryRecord } from "./crm-readers.js";
import { CrmSyncService } from "./crm-sync-service.js";

const noDealNaming = {
  forLotWon: vi.fn(),
  forShopEnquiry: vi.fn(),
  forShopOrder: vi.fn(),
};

const ENQUIRY_ID = "11111111-1111-4111-8111-111111111111";

const event = {
  id: 1,
  eventType: "marketing_enquiry.received",
  aggregateId: ENQUIRY_ID,
  schemaVersion: 1,
  payload: { enquiryId: ENQUIRY_ID, intent: "private_sale_sell", department: "modern-british" },
};

function enquiry(overrides: Partial<CrmEnquiryRecord> = {}): CrmEnquiryRecord {
  return {
    id: ENQUIRY_ID,
    reference: "E-1001",
    intent: "private_sale_sell",
    departmentSlug: "modern-british",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "+447700900123",
    marketingOptIn: true,
    createdAt: new Date("2026-11-03T09:30:00Z"),
    artist: null,
    userId: null,
    ...overrides,
  };
}

const ctx = {
  leadStatusNew: "New (Unassigned)",
  auctionPipeline: "",
  dealStageLotWon: "",
  dealStagePaymentCaptured: "",
  dealStagePaymentRefunded: "",
  dealStageShopPaid: "",
  dealStageShopEnquiry: "",
};

describe("marketing_enquiry.received mapping", () => {
  it("maps the enquiry to a Lead with source, intent, department and reference", () => {
    const intent = mapDomainEventToCrmIntent(event, ctx, { enquiry: enquiry() });
    expect(intent.kind).toBe("person_upsert");
    if (intent.kind !== "person_upsert") return;
    expect(intent.subjectId).toBe(`enquiry:${ENQUIRY_ID}`);
    expect(intent.email).toBe("ada@example.com");
    expect(intent.fields).toMatchObject({
      Email: "ada@example.com",
      First_Name: "Ada",
      Last_Name: "Lovelace",
      Phone: "+447700900123",
      [CRM_FIELD.leadSourceDetailed]: CRM_LEAD_SOURCE_BID_PRIVATE_SALE_ENQUIRY,
      [CRM_FIELD.enquiryIntent]: "Sell privately",
      [CRM_FIELD.enquiryDepartment]: "modern-british",
      [CRM_FIELD.enquiryReference]: "E-1001",
      [CRM_FIELD.subjectExternalId]: `enquiry:${ENQUIRY_ID}`,
    });
  });

  it("labels buy-privately and general intents", () => {
    const labelFor = (intentValue: string) => {
      const mapped = mapDomainEventToCrmIntent(event, ctx, {
        enquiry: enquiry({ intent: intentValue }),
      });
      return mapped.kind === "person_upsert" ? mapped.fields[CRM_FIELD.enquiryIntent] : null;
    };
    expect(labelFor("private_sale_buy")).toBe("Buy privately");
    expect(labelFor("general")).toBe("General");
    expect(labelFor("press")).toBe("General");
  });

  it("sets the opt-out flag from marketing consent", () => {
    const optOut = (marketingOptIn: boolean) => {
      const mapped = mapDomainEventToCrmIntent(event, ctx, {
        enquiry: enquiry({ marketingOptIn }),
      });
      return mapped.kind === "person_upsert" ? mapped.fields[CRM_FIELD.emailOptOut] : null;
    };
    expect(optOut(true)).toBe(false);
    expect(optOut(false)).toBe(true);
  });

  it("keys a signed-in sender's lead by their account and omits empty optional fields", () => {
    const mapped = mapDomainEventToCrmIntent(event, ctx, {
      enquiry: enquiry({ userId: "user-1", phone: null, departmentSlug: null }),
    });
    expect(mapped.kind).toBe("person_upsert");
    if (mapped.kind !== "person_upsert") return;
    expect(mapped.subjectId).toBe("user-1");
    expect(mapped.fields).not.toHaveProperty("Phone");
    expect(mapped.fields).not.toHaveProperty(CRM_FIELD.enquiryDepartment);
  });

  it("never sends the message, price or attachments", () => {
    const withExtras = {
      ...enquiry(),
      message: "A private message",
      priceInMindMinor: 25_000_000,
      attachments: ["file-1"],
    } as CrmEnquiryRecord;
    const mapped = mapDomainEventToCrmIntent(event, ctx, { enquiry: withExtras });
    const serialised = JSON.stringify(mapped);
    expect(serialised).not.toContain("A private message");
    expect(serialised).not.toContain("25000000");
    expect(serialised).not.toContain("file-1");
  });

  it("skips when the enquiry no longer exists", () => {
    expect(mapDomainEventToCrmIntent(event, ctx, { enquiry: null })).toEqual({
      kind: "skip",
      reason: "enquiry_not_found",
    });
  });
});

describe("enquiry lead rules", () => {
  const fieldsFor = (overrides: Partial<CrmEnquiryRecord>) => {
    const mapped = mapDomainEventToCrmIntent(event, ctx, { enquiry: enquiry(overrides) });
    if (mapped.kind !== "person_upsert") throw new Error("expected person_upsert");
    return mapped;
  };

  it("starts a new lead as New (Unassigned) from the website, on creation only", () => {
    const mapped = fieldsFor({});
    expect(mapped.createOnlyFields).toEqual({
      [CRM_FIELD.leadStatus]: "New (Unassigned)",
      [CRM_FIELD.leadSource]: "Website",
    });
    expect(mapped.fields).not.toHaveProperty(CRM_FIELD.leadStatus);
  });

  it.each([
    ["private_sale_buy", null, "Original"],
    ["private_sale_sell", "modern-british", "Auction"],
    ["general", null, "General"],
    ["press", null, "General"],
    ["buying", "prints", "Prints"],
    ["general", "corporate", "Corporate"],
  ])("maps intent %s / department %s to Enquiry Type %s", (intent, departmentSlug, expected) => {
    expect(fieldsFor({ intent, departmentSlug }).fields[CRM_FIELD.enquiryType]).toBe(expected);
  });

  it("labels a general contact form enquiry separately from a private sale", () => {
    expect(fieldsFor({ intent: "general" }).fields[CRM_FIELD.leadSourceDetailed]).toBe(
      "LAX Bid enquiry",
    );
    expect(fieldsFor({ intent: "private_sale_buy" }).fields[CRM_FIELD.leadSourceDetailed]).toBe(
      "LAX Bid private sale enquiry",
    );
  });

  it("records consent with the day it was given when the sender opted in", () => {
    expect(fieldsFor({ marketingOptIn: true }).fields).toMatchObject({
      [CRM_FIELD.consentMarketingOptIn]: true,
      [CRM_FIELD.consentTimestamp]: "2026-11-03",
      [CRM_FIELD.consentSource]: "Website",
      [CRM_FIELD.dataProcessingNoticeConfirmed]: true,
    });
  });

  it("never defaults to opted in", () => {
    const { fields } = fieldsFor({ marketingOptIn: false });
    expect(fields[CRM_FIELD.consentMarketingOptIn]).toBe(false);
    expect(fields).not.toHaveProperty(CRM_FIELD.consentTimestamp);
    expect(fields).not.toHaveProperty(CRM_FIELD.consentSource);
  });

  it("carries the artist a private sale enquiry names", () => {
    expect(fieldsFor({ artist: " Banksy " }).fields[CRM_FIELD.interestedArtist]).toBe("Banksy");
    expect(fieldsFor({ artist: null }).fields).not.toHaveProperty(CRM_FIELD.interestedArtist);
  });
});

function inMemoryLinkRepo() {
  const links = new Map<string, CrmRecordLinkRow>();
  const repo = {
    findByEntity: vi.fn(async (type: string, id: string) => links.get(`${type}:${id}`) ?? null),
    upsertLink: vi.fn(
      async (input: {
        entityType: string;
        entityId: string;
        zohoModule: string;
        zohoRecordId: string;
      }) => {
        links.set(`${input.entityType}:${input.entityId}`, {
          ...input,
          subjectId: null,
          erasedAt: null,
          deletionRequestedAt: null,
          recyclePurgedAt: null,
          heldPayload: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as CrmRecordLinkRow);
      },
    ),
    isDeletionRequested: vi.fn().mockResolvedValue(false),
    isErased: vi.fn().mockResolvedValue(false),
  } as unknown as ICrmRecordLinkRepository;
  return { repo, links };
}

function buildService(enquiryRecord: CrmEnquiryRecord | null) {
  const gateway = {
    upsert: vi.fn().mockResolvedValue({
      module: "Leads",
      recordId: "lead-1",
      action: "insert",
      status: "success",
    }),
    findByEmail: vi.fn().mockResolvedValue(null),
    getMetrics: () => ({ apiCreditsRemaining: null }),
  } as unknown as CrmGateway;
  const { repo, links } = inMemoryLinkRepo();
  const findById = vi.fn().mockResolvedValue(enquiryRecord);
  const service = new CrmSyncService({
    gateway,
    linkRepo: repo,
    env: {} as WorkerEnv,
    mapperContext: ctx,
    paymentLotReader: { findLotIdForPayment: vi.fn() },
    attributionReader: { loadFirstTouchFields: vi.fn() },
    enquiryReader: { findById },
    dealNamingReader: noDealNaming,
  });
  return { service, gateway, links, findById };
}

describe("CrmSyncService marketing_enquiry.received (dry-run client)", () => {
  it("reads the enquiry by id and upserts one Lead", async () => {
    const { service, gateway, links, findById } = buildService(enquiry());

    const result = await service.syncEvent(event);

    expect(findById).toHaveBeenCalledWith(ENQUIRY_ID);
    expect(result).toEqual({ outcome: "success", providerReference: "Leads:lead-1:insert" });
    expect(gateway.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        module: "Leads",
        duplicateCheckFields: [CRM_FIELD.subjectExternalId, "Email"],
        fields: expect.objectContaining({ Email: "ada@example.com" }),
      }),
    );
    expect(links.get(`subject:enquiry:${ENQUIRY_ID}`)?.zohoRecordId).toBe("lead-1");
  });

  it("is idempotent: a repeated event keeps one link and the same duplicate-check keys", async () => {
    const { service, gateway, links } = buildService(enquiry());

    await service.syncEvent(event);
    await service.syncEvent(event);

    expect(links.size).toBe(1);
    const calls = vi.mocked(gateway.upsert).mock.calls;
    expect(calls).toHaveLength(2);
    // The repeat finds the lead it created: status and primary source are left to the admins.
    const { Lead_Status, Lead_Source, ...firstFields } = calls[0]?.[0]?.fields ?? {};
    expect(Lead_Status).toBe("New (Unassigned)");
    expect(Lead_Source).toBe("Website");
    expect(calls[1]?.[0]).toEqual({ ...calls[0]?.[0], fields: firstFields });
  });

  it("skips without calling the CRM when the enquiry is gone", async () => {
    const { service, gateway } = buildService(null);

    const result = await service.syncEvent(event);

    expect(result).toEqual({ outcome: "skipped", reason: "enquiry_not_found" });
    expect(gateway.upsert).not.toHaveBeenCalled();
  });
});
