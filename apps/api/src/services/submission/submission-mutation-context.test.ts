import type { IRepositoryFactory } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import { txRepos } from "./submission-mutation-context.js";
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
    domainEventPublisher: null,
    domainEventSink: null,
    mediaUrlResolver: undefined,
    mediaAssetEnricher: undefined,
    lotLifecycleRecording: null,
    repoFactory: null,
    ...overrides,
  };
}

describe("txRepos", () => {
  it("throws when repoFactory is missing", () => {
    expect(() => txRepos(baseDeps(), {} as never)).toThrow("item_submission_repo_factory_required");
  });

  it("uses forTransaction not forConnection", () => {
    const repos = { itemSubmission: {}, lot: {} };
    const forTransaction = vi.fn().mockReturnValue(repos);
    const forConnection = vi.fn();
    const deps = baseDeps({
      repoFactory: { forTransaction, forConnection } as unknown as IRepositoryFactory,
    });
    const tx = {} as never;
    expect(txRepos(deps, tx)).toBe(repos);
    expect(forTransaction).toHaveBeenCalledWith(tx);
    expect(forConnection).not.toHaveBeenCalled();
  });
});
