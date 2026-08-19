import type { IdentityEventPublisher } from "@auction/auth";
import { describe, expect, it, vi } from "vitest";
import type {
  IIdentityLifecycleRepository,
  IdentityLifecycleMutationOutcome,
} from "./identity-lifecycle.ports.js";
import {
  type IdentityLifecycleConflictError,
  IdentityLifecycleService,
} from "./identity-lifecycle.service.js";

const NOW = new Date("2026-08-19T00:00:00.000Z");

function setup(
  options: {
    disable?: IdentityLifecycleMutationOutcome;
    enable?: IdentityLifecycleMutationOutcome;
    merge?: IdentityLifecycleMutationOutcome;
  } = {},
) {
  const transactionHandle = { kind: "identity-transaction" };
  const transaction = vi.fn(async (operation: (value: unknown) => Promise<void>) =>
    operation(transactionHandle),
  );
  const disableSubject = vi.fn(async () => options.disable ?? "updated");
  const enableSubject = vi.fn(async () => options.enable ?? "updated");
  const mergeSubjects = vi.fn(async () => options.merge ?? "updated");
  const repository = {
    transaction,
    disableSubject,
    enableSubject,
    mergeSubjects,
  } satisfies IIdentityLifecycleRepository;
  const publish = vi.fn(async () => undefined);
  const publisher = { publish } as IdentityEventPublisher;
  const revokeSubject = vi.fn(async () => 0);
  return {
    service: new IdentityLifecycleService(repository, publisher, { revokeSubject }, () => NOW),
    transaction,
    disableSubject,
    enableSubject,
    mergeSubjects,
    publish,
    revokeSubject,
    transactionHandle,
  };
}

describe("IdentityLifecycleService", () => {
  it("disables Identity, appends the event in-transaction, then dispatches logout", async () => {
    const { service, disableSubject, publish, revokeSubject, transactionHandle } = setup();
    await service.disable("subject-1", " security_review ");

    expect(disableSubject).toHaveBeenCalledWith(transactionHandle, {
      subjectId: "subject-1",
      reason: "security_review",
      now: NOW,
    });
    expect(publish).toHaveBeenCalledWith(
      {
        type: "user.identity_disabled",
        userId: "subject-1",
        reason: "security_review",
      },
      { producer: "apps/auth", transaction: transactionHandle },
    );
    expect(revokeSubject).toHaveBeenCalledWith("subject-1");
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(
      revokeSubject.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("enables Identity and appends the versioned event", async () => {
    const { service, enableSubject, publish, revokeSubject, transactionHandle } = setup();
    await service.enable("subject-1");
    expect(enableSubject).toHaveBeenCalledWith(transactionHandle, {
      subjectId: "subject-1",
      now: NOW,
    });
    expect(publish).toHaveBeenCalledWith(
      { type: "user.identity_enabled", userId: "subject-1" },
      { producer: "apps/auth", transaction: transactionHandle },
    );
    expect(revokeSubject).not.toHaveBeenCalled();
  });

  it("merges subjects, publishes the alias event, then logs out only the retired subject", async () => {
    const { service, mergeSubjects, publish, revokeSubject, transactionHandle } = setup();
    await service.merge("retired-1", "canonical-1");
    expect(mergeSubjects).toHaveBeenCalledWith(transactionHandle, {
      retiredSubjectId: "retired-1",
      canonicalSubjectId: "canonical-1",
      now: NOW,
    });
    expect(publish).toHaveBeenCalledWith(
      {
        type: "user.identity_merged",
        retiredSubjectId: "retired-1",
        canonicalSubjectId: "canonical-1",
      },
      { producer: "apps/auth", transaction: transactionHandle },
    );
    expect(revokeSubject).toHaveBeenCalledWith("retired-1");
  });

  it.each(["disable", "enable", "merge"] as const)(
    "does not publish or logout for an unchanged %s operation",
    async (operation) => {
      const options = { [operation]: "unchanged" } as {
        disable?: IdentityLifecycleMutationOutcome;
        enable?: IdentityLifecycleMutationOutcome;
        merge?: IdentityLifecycleMutationOutcome;
      };
      const { service, publish, revokeSubject } = setup(options);
      if (operation === "disable") await service.disable("subject-1");
      if (operation === "enable") await service.enable("subject-1");
      if (operation === "merge") await service.merge("retired-1", "canonical-1");
      expect(publish).not.toHaveBeenCalled();
      expect(revokeSubject).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["not_found", "subject_not_found"],
    ["invalid_merge", "invalid_merge"],
  ] as const)("maps repository outcome %s to conflict %s", async (outcome, code) => {
    const { service, publish, revokeSubject } = setup({ disable: outcome });
    await expect(service.disable("subject-1")).rejects.toMatchObject({
      code,
    } satisfies Partial<IdentityLifecycleConflictError>);
    expect(publish).not.toHaveBeenCalled();
    expect(revokeSubject).not.toHaveBeenCalled();
  });

  it("rejects a self-merge before opening a transaction", async () => {
    const { service, transaction } = setup();
    await expect(service.merge("subject-1", "subject-1")).rejects.toMatchObject({
      code: "invalid_merge",
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("does not dispatch logout when event publication fails", async () => {
    const { service, publish, revokeSubject } = setup();
    publish.mockRejectedValueOnce(new Error("outbox unavailable"));
    await expect(service.disable("subject-1")).rejects.toThrow("outbox unavailable");
    expect(revokeSubject).not.toHaveBeenCalled();
  });
});
