import type {
  ArtistDeleteGuardCounts,
  DbTransaction,
  IArtistDeleteGuards,
  IArtistDeleteRepository,
} from "@auction/persistence";
import type { ArtistProfile } from "@auction/types";
import { err } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { ArtistError, AuthzError } from "../lib/errors.js";
import { mockDomainEventSink } from "../test/domain-event-sink-mock.js";
import { transactionRunnerFromDb } from "../test/transaction-runner-from-db.js";
import { ArtistDeleteService } from "./artist-delete.service.js";
import type { IDomainEventSink } from "./domain-event-sink.js";

function artist(overrides: Partial<ArtistProfile> = {}): ArtistProfile {
  return {
    id: "a1",
    displayName: "Test Artist",
    slug: "test-artist",
    portraitUrl: null,
    heroImageUrl: null,
    shortBio: null,
    longBio: null,
    statement: null,
    nationality: null,
    location: null,
    countryCode: null,
    birthYear: null,
    deathYear: null,
    foundedYear: null,
    dissolvedYear: null,
    websiteUrl: null,
    socialLinks: {},
    attributes: {},
    featured: false,
    verified: false,
    archived: false,
    status: "pending",
    ownerUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const zeroGuards: ArtistDeleteGuardCounts = {
  lotCount: 0,
  mergeDependentCount: 0,
  watchlistCount: 0,
};

function createService(overrides: {
  guards?: Partial<IArtistDeleteGuards>;
  repo?: Partial<IArtistDeleteRepository>;
  db?: { transaction: ReturnType<typeof vi.fn> };
  domainEvents?: IDomainEventSink | null;
}) {
  const tx = {} as DbTransaction;
  const guards: IArtistDeleteGuards = {
    countDeleteGuards: vi.fn().mockResolvedValue(zeroGuards),
    ...overrides.guards,
  };
  const repo: IArtistDeleteRepository = {
    findById: vi.fn().mockResolvedValue(artist()),
    findByIdForUpdate: vi.fn().mockResolvedValue(artist()),
    deleteById: vi.fn().mockResolvedValue(true),
    ...overrides.repo,
  };
  const db = overrides.db ?? {
    transaction: vi.fn(async (fn: (t: DbTransaction) => Promise<unknown>) => fn(tx)),
  };
  const domainEvents =
    overrides.domainEvents === undefined ? null : (overrides.domainEvents ?? mockDomainEventSink());
  const transactionRunner = transactionRunnerFromDb(db as never);
  const svc = new ArtistDeleteService(guards, repo, transactionRunner, domainEvents);
  return { svc, guards, repo, transactionRunner, tx, domainEvents };
}

describe("ArtistDeleteService.getDeleteEligibility", () => {
  it("returns null when artist missing", async () => {
    const { svc } = createService({
      repo: { findById: vi.fn().mockResolvedValue(null) },
    });
    await expect(svc.getDeleteEligibility("missing")).resolves.toBeNull();
  });

  it("returns confirmation phrase when deletable", async () => {
    const { svc } = createService({});
    const result = await svc.getDeleteEligibility("a1");
    expect(result?.canDelete).toBe(true);
    expect(result?.confirmationPhrase).toBe("DELETE Test Artist");
  });
});

describe("ArtistDeleteService.delete", () => {
  it("returns AuthzError when capability missing", async () => {
    const { svc } = createService({});
    const result = await svc.delete("u1", "staff", "a1", "DELETE Test Artist", "specialist");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(AuthzError);
    }
  });

  it("returns phrase mismatch error", async () => {
    const { svc } = createService({});
    const result = await svc.delete("u1", "staff", "a1", "DELETE Wrong", "catalogue_manager");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ArtistError);
      expect((result.error as ArtistError).code).toBe("artist_delete_phrase_mismatch");
    }
  });

  it("returns blocked when guards fail inside transaction", async () => {
    const { svc, guards } = createService({
      guards: {
        countDeleteGuards: vi.fn().mockResolvedValue({
          lotCount: 1,
          mergeDependentCount: 0,
          watchlistCount: 0,
        }),
      },
    });
    const result = await svc.delete("u1", "staff", "a1", "DELETE Test Artist", "catalogue_manager");
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ArtistError);
      expect((result.error as ArtistError).code).toBe("artist_delete_blocked");
    }
    expect(guards.countDeleteGuards).toHaveBeenCalledTimes(1);
  });

  it("deletes and publishes event on success", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deleteById = vi.fn().mockResolvedValue(true);
    const { svc, repo } = createService({
      repo: { deleteById },
      domainEvents: mockDomainEventSink(publish),
    });
    const result = await svc.delete("u1", "staff", "a1", "DELETE Test Artist", "catalogue_manager");
    expect(result.isOk()).toBe(true);
    expect(deleteById).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "artist.deleted", aggregateId: "a1" }),
    );
    expect(repo.findByIdForUpdate).toHaveBeenCalled();
  });

  it("maps postgres fk violation to artist_delete_fk_violation", async () => {
    const fkError = Object.assign(new Error("fk"), { code: "23503" });
    const { svc } = createService({
      db: { transaction: vi.fn().mockRejectedValue(fkError) },
    });
    const result = await svc.delete("u1", "staff", "a1", "DELETE Test Artist", "catalogue_manager");
    expect(result).toEqual(
      err(
        expect.objectContaining({
          code: "artist_delete_fk_violation",
        }),
      ),
    );
  });
});
