import { describe, expect, it, vi } from "vitest";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IEnsurePersonalLegalEntityService } from "./ensure-personal-legal-entity.service.js";
import {
  PersonalLegalEntityResolver,
  PersonalLegalEntityUnavailableError,
} from "./personal-legal-entity-resolver.service.js";

const USER_ID = "user-1";
const PERSONAL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const personalSummary = {
  id: PERSONAL_ID,
  displayName: "Jane Doe",
  kind: "individual" as const,
  subkind: "private_collector" as const,
  status: "approved" as const,
  role: "owner" as const,
  isPrimaryAdmin: true,
};

function makeRepo(ensurePersonalEntity: ILegalEntityRepository["ensurePersonalEntity"]) {
  const stub: ILegalEntityRepository = {
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    listActiveMembershipsForUser: vi.fn(),
    findActiveMembership: vi.fn(),
    listImpersonationNoticeRecipientEmails: vi.fn().mockResolvedValue([]),
    setXeroContactId: vi.fn(),
    setStripeCustomerId: vi.fn(),
    findPrimaryAddressForXero: vi.fn().mockResolvedValue(null),
    findPreferredBillToLegalEntityAddress: vi.fn().mockResolvedValue(null),
    ensurePersonalEntity,
  };
  return stub;
}

describe("PersonalLegalEntityResolver", () => {
  it("returns existing personal entity on fast path", async () => {
    const ensurePersonalEntity = vi.fn().mockResolvedValue(personalSummary);
    const ensure = vi.fn();
    const users = { getById: vi.fn() };
    const resolver = new PersonalLegalEntityResolver(
      makeRepo(ensurePersonalEntity),
      { ensure } satisfies IEnsurePersonalLegalEntityService,
      users,
    );

    const result = await resolver.resolveForUser(USER_ID);

    expect(result).toEqual(personalSummary);
    expect(ensure).not.toHaveBeenCalled();
    expect(users.getById).not.toHaveBeenCalled();
  });

  it("lazy-provisions when personal entity is missing", async () => {
    const ensurePersonalEntity = vi
      .fn()
      .mockRejectedValueOnce(new Error("missing"))
      .mockResolvedValueOnce(personalSummary);
    const ensure = vi.fn().mockResolvedValue({ legalEntityId: PERSONAL_ID, created: true });
    const users = {
      getById: vi.fn().mockResolvedValue({ email: "jane@example.com", name: "Jane Doe" }),
    };
    const resolver = new PersonalLegalEntityResolver(
      makeRepo(ensurePersonalEntity),
      { ensure } satisfies IEnsurePersonalLegalEntityService,
      users,
    );

    const result = await resolver.resolveForUser(USER_ID);

    expect(result).toEqual(personalSummary);
    expect(ensure).toHaveBeenCalledWith({
      userId: USER_ID,
      displayName: "Jane Doe",
      email: "jane@example.com",
    });
    expect(ensurePersonalEntity).toHaveBeenCalledTimes(2);
  });

  it("throws PersonalLegalEntityUnavailableError when user is missing", async () => {
    const ensurePersonalEntity = vi.fn().mockRejectedValue(new Error("missing"));
    const ensure = vi.fn();
    const users = { getById: vi.fn().mockResolvedValue(null) };
    const resolver = new PersonalLegalEntityResolver(
      makeRepo(ensurePersonalEntity),
      { ensure } satisfies IEnsurePersonalLegalEntityService,
      users,
    );

    await expect(resolver.resolveForUser(USER_ID)).rejects.toBeInstanceOf(
      PersonalLegalEntityUnavailableError,
    );
    expect(ensure).not.toHaveBeenCalled();
  });

  it("throws PersonalLegalEntityUnavailableError when provision still fails", async () => {
    const ensurePersonalEntity = vi.fn().mockRejectedValue(new Error("missing"));
    const ensure = vi.fn().mockResolvedValue({ legalEntityId: PERSONAL_ID, created: true });
    const users = {
      getById: vi.fn().mockResolvedValue({ email: "jane@example.com", name: "Jane Doe" }),
    };
    const resolver = new PersonalLegalEntityResolver(
      makeRepo(ensurePersonalEntity),
      { ensure } satisfies IEnsurePersonalLegalEntityService,
      users,
    );

    await expect(resolver.resolveForUser(USER_ID)).rejects.toBeInstanceOf(
      PersonalLegalEntityUnavailableError,
    );
    expect(ensure).toHaveBeenCalled();
  });
});
