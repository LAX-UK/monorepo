import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import {
  assertSellerEntityAllows,
  assertSellerEntityAllowsSubmissions,
  maybeLogRestrictedSellerWrite,
} from "./submission-seller-gate.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

function baseDeps(overrides: Partial<ItemSubmissionServiceDeps> = {}): ItemSubmissionServiceDeps {
  return {
    transactionRunner: {
      runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
    } as never,
    submissions: {} as never,
    users: {} as never,
    dispatcher: {} as never,
    imageCleanup: undefined,
    legalEntityNotificationRecipients: null,
    legalEntityRepository: null,
    domainEventSink: null,
    mediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    lotLifecycleRecording: null,
    repoFactory: null,
    consignmentAgreements: null,
    sellerIdentity: null,
    staffRoles: null,
    ...overrides,
  };
}

describe("assertSellerEntityAllowsSubmissions", () => {
  it("allows when legalEntityRepository is null", async () => {
    const result = await assertSellerEntityAllowsSubmissions(baseDeps(), "le-1");
    expect(result.isOk()).toBe(true);
  });

  it("blocks rejected individual", async () => {
    const deps = baseDeps({
      legalEntityRepository: {
        findById: vi.fn().mockResolvedValue({ kind: "individual", status: "rejected" }),
      } as unknown as ILegalEntityRepository,
    });
    const result = await assertSellerEntityAllowsSubmissions(deps, "le-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(403);
  });

  it("blocks archived individual", async () => {
    const deps = baseDeps({
      legalEntityRepository: {
        findById: vi.fn().mockResolvedValue({ kind: "individual", status: "archived" }),
      } as unknown as ILegalEntityRepository,
    });
    const result = await assertSellerEntityAllowsSubmissions(deps, "le-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(403);
  });

  it.each(["restricted", "rejected", "archived"])("blocks a %s organisation", async (status) => {
    const deps = baseDeps({
      legalEntityRepository: {
        findById: vi.fn().mockResolvedValue({ kind: "organisation", status }),
      } as unknown as ILegalEntityRepository,
    });
    const result = await assertSellerEntityAllowsSubmissions(deps, "le-1");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(403);
  });
});

describe("assertSellerEntityAllows for an organisation under review", () => {
  const deps = () =>
    baseDeps({
      legalEntityRepository: {
        findById: vi.fn().mockResolvedValue({ kind: "organisation", status: "under_review" }),
      } as unknown as ILegalEntityRepository,
    });

  it("lets it save drafts", async () => {
    expect((await assertSellerEntityAllows(deps(), "le-1", "draft")).isOk()).toBe(true);
  });

  it("refuses submitting and says why", async () => {
    const result = await assertSellerEntityAllows(deps(), "le-1", "submit");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().status).toBe(403);
    expect(result._unsafeUnwrapErr().message).toMatch(/still checking/);
  });
});

describe("maybeLogRestrictedSellerWrite", () => {
  it("publishes when entity is restricted", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      legalEntityRepository: {
        findById: vi.fn().mockResolvedValue({ status: "restricted" }),
      } as unknown as ILegalEntityRepository,
      domainEventSink: mockDomainEventSink(publish) as unknown as IDomainEventSink,
    });
    await maybeLogRestrictedSellerWrite(deps, "le-1", "sub-1", "create_draft");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "item_submission.restricted_entity_write",
        payload: { legalEntityId: "le-1", submissionId: "sub-1", action: "create_draft" },
      }),
    );
  });

  it("no-ops when entity is not restricted", async () => {
    const publish = vi.fn();
    const deps = baseDeps({
      legalEntityRepository: {
        findById: vi.fn().mockResolvedValue({ status: "approved" }),
      } as unknown as ILegalEntityRepository,
      domainEventSink: mockDomainEventSink(publish) as unknown as IDomainEventSink,
    });
    await maybeLogRestrictedSellerWrite(deps, "le-1", "sub-1", "create_draft");
    expect(publish).not.toHaveBeenCalled();
  });
});
