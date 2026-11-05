import type {
  CrmRecordLinkRow,
  ICrmRecordLinkRepository,
  UpsertCrmRecordLinkInput,
} from "@auction/persistence/interfaces";
import { vi } from "vitest";
import type { CrmGateway } from "./crm-gateway.js";

const HELD = "__held__";
const TOMBSTONE = "__tombstone__";

/** The delivery ledger in memory, with the same rules as the Drizzle repository. */
export class InMemoryCrmLinkRepo implements ICrmRecordLinkRepository {
  readonly rows = new Map<string, CrmRecordLinkRow>();

  private key(entityType: string, entityId: string): string {
    return `${entityType}\u0000${entityId}`;
  }

  async findByEntity(entityType: string, entityId: string): Promise<CrmRecordLinkRow | null> {
    return this.rows.get(this.key(entityType, entityId)) ?? null;
  }

  async upsertLink(input: UpsertCrmRecordLinkInput): Promise<void> {
    const now = input.now ?? new Date();
    const existing = this.rows.get(this.key(input.entityType, input.entityId));
    this.rows.set(this.key(input.entityType, input.entityId), {
      entityType: input.entityType,
      entityId: input.entityId,
      zohoModule: input.zohoModule,
      zohoRecordId: input.zohoRecordId,
      subjectId: input.subjectId !== undefined ? input.subjectId : (existing?.subjectId ?? null),
      erasedAt: null,
      deletionRequestedAt: existing?.deletionRequestedAt ?? null,
      recyclePurgedAt: existing?.recyclePurgedAt ?? null,
      heldPayload: input.heldPayload ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async mergeSubjectLinks(): Promise<Record<string, never>> {
    return {};
  }

  async reassignDealLinksSubjectId(): Promise<number> {
    return 0;
  }

  async markErased(entityType: string, entityId: string, now = new Date()): Promise<void> {
    const row = this.rows.get(this.key(entityType, entityId));
    if (row) this.rows.set(this.key(entityType, entityId), { ...row, erasedAt: now });
  }

  async tombstone(input: {
    entityType: string;
    entityId: string;
    tombstoneModule: string;
    tombstoneRecordId: string;
    now?: Date;
  }): Promise<void> {
    const now = input.now ?? new Date();
    const existing = this.rows.get(this.key(input.entityType, input.entityId));
    this.rows.set(this.key(input.entityType, input.entityId), {
      entityType: input.entityType,
      entityId: input.entityId,
      zohoModule: input.tombstoneModule,
      zohoRecordId: input.tombstoneRecordId,
      subjectId: existing?.subjectId ?? null,
      erasedAt: now,
      deletionRequestedAt: existing?.deletionRequestedAt ?? null,
      recyclePurgedAt: existing?.recyclePurgedAt ?? null,
      heldPayload: null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }

  async tombstoneDealByZohoRecordId(zohoRecordId: string): Promise<void> {
    for (const [key, row] of this.rows) {
      if (row.entityType === "deal" && row.zohoRecordId === zohoRecordId && !row.erasedAt) {
        this.rows.set(key, { ...row, erasedAt: new Date() });
      }
    }
  }

  async setDeletionRequested(entityType: string, entityId: string): Promise<void> {
    const row = this.rows.get(this.key(entityType, entityId));
    if (row) {
      this.rows.set(this.key(entityType, entityId), { ...row, deletionRequestedAt: new Date() });
    }
  }

  async clearDeletionRequested(entityType: string, entityId: string): Promise<void> {
    const row = this.rows.get(this.key(entityType, entityId));
    if (row) {
      this.rows.set(this.key(entityType, entityId), { ...row, deletionRequestedAt: null });
    }
  }

  async isDeletionRequested(entityType: string, entityId: string): Promise<boolean> {
    return (await this.findByEntity(entityType, entityId))?.deletionRequestedAt != null;
  }

  async markRecyclePurged(entityType: string, entityId: string): Promise<void> {
    const row = this.rows.get(this.key(entityType, entityId));
    if (row) {
      this.rows.set(this.key(entityType, entityId), { ...row, recyclePurgedAt: new Date() });
    }
  }

  async isErased(entityType: string, entityId: string): Promise<boolean> {
    return (await this.findByEntity(entityType, entityId))?.erasedAt != null;
  }

  async listActiveDealLinksBySubject(subjectId: string): Promise<CrmRecordLinkRow[]> {
    return this.listActiveLinksBySubject(subjectId, ["deal"]);
  }

  async listActiveLinksBySubject(
    subjectId: string,
    entityTypes: string[],
  ): Promise<CrmRecordLinkRow[]> {
    return [...this.rows.values()].filter(
      (r) => r.subjectId === subjectId && entityTypes.includes(r.entityType) && !r.erasedAt,
    );
  }

  async listHeldDeals(limit: number, checkedBefore?: Date): Promise<CrmRecordLinkRow[]> {
    return [...this.rows.values()]
      .filter(
        (r) =>
          r.entityType === "deal" &&
          r.zohoModule === HELD &&
          !r.erasedAt &&
          (!checkedBefore || r.updatedAt < checkedBefore),
      )
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .slice(0, limit);
  }

  async touchLink(entityType: string, entityId: string, now = new Date()): Promise<void> {
    const row = this.rows.get(this.key(entityType, entityId));
    if (row) this.rows.set(this.key(entityType, entityId), { ...row, updatedAt: now });
  }

  async eraseHeldDealsBySubject(subjectId: string): Promise<number> {
    let erased = 0;
    for (const [key, row] of this.rows) {
      if (
        row.entityType === "deal" &&
        row.subjectId === subjectId &&
        row.zohoModule === HELD &&
        !row.erasedAt
      ) {
        this.rows.set(key, {
          ...row,
          zohoModule: TOMBSTONE,
          zohoRecordId: "__none__",
          heldPayload: null,
          erasedAt: new Date(),
        });
        erased += 1;
      }
    }
    return erased;
  }

  async listActiveSubjectLinksByZohoRecord(
    zohoModule: string,
    zohoRecordId: string,
  ): Promise<CrmRecordLinkRow[]> {
    return [...this.rows.values()].filter(
      (r) =>
        r.entityType === "subject" &&
        r.zohoModule === zohoModule &&
        r.zohoRecordId === zohoRecordId &&
        !r.erasedAt,
    );
  }

  async listActiveByEntityType(entityType: string): Promise<CrmRecordLinkRow[]> {
    return [...this.rows.values()].filter((r) => r.entityType === entityType && !r.erasedAt);
  }

  async listErasedWithRealZohoLinks(): Promise<CrmRecordLinkRow[]> {
    return [];
  }

  /** Seeds a subject link to a Zoho Lead or Contact. */
  async seedSubject(subjectId: string, zohoModule: "Leads" | "Contacts", zohoRecordId: string) {
    await this.upsertLink({ entityType: "subject", entityId: subjectId, zohoModule, zohoRecordId });
  }
}

export type FakeCrmGateway = CrmGateway & {
  [K in keyof CrmGateway]: CrmGateway[K] extends (...args: never[]) => unknown
    ? ReturnType<typeof vi.fn> & CrmGateway[K]
    : CrmGateway[K];
};

/** A gateway whose every call succeeds and records its input. */
export function fakeCrmGateway(overrides: Partial<CrmGateway> = {}): FakeCrmGateway {
  let nextId = 1;
  const ok = (module: string, action: string) =>
    vi.fn(async () => ({
      module,
      recordId: `${module.toLowerCase()}-${nextId++}`,
      action,
      status: "success",
    }));
  return {
    upsert: ok("Deals", "upsert"),
    upsertMany: vi.fn(async () => []),
    updateById: vi.fn(async (input: { module: string; recordId: string }) => ({
      module: input.module,
      recordId: input.recordId,
      action: "update",
      status: "success",
    })),
    findByEmail: vi.fn(async () => null),
    findDealIdsByContact: vi.fn(async () => []),
    executeCoql: vi.fn(async () => []),
    createRecord: vi.fn(async (input: { module: string }) => ({
      module: input.module,
      recordId: `${input.module.toLowerCase()}-${nextId++}`,
      action: "insert",
      status: "success",
    })),
    findLead: vi.fn(async () => null),
    deleteRecord: vi.fn(async () => ({ status: "deleted" })),
    purgeFromRecycleBin: vi.fn(async () => undefined),
    getMetrics: () => ({ apiCreditsRemaining: null }),
    ...overrides,
  } as unknown as FakeCrmGateway;
}
