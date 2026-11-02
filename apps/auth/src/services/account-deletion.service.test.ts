import type { ProductDeletionEligibility } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { AccountDeletionService } from "./account-deletion.service.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-10-23T12:00:00.000Z");
const BLOCKER = { code: "pay", message: "Pay the invoice.", href: "https://bid.example/pay" };

type Answers = Partial<Record<"bid" | "shop", ProductDeletionEligibility | Error>>;

function setup(
  options: { answers?: Answers; deletionRequestedAt?: Date | null; sessionAgeMs?: number } = {},
) {
  const createdAt = new Date(NOW.getTime() - (options.sessionAgeMs ?? 60_000));
  const operations = {
    readSecurityStatus: vi.fn(async () => ({
      twoFactorEnabled: false,
      phoneNumber: null,
      phoneNumberVerified: false,
      pendingNewEmail: null,
      emailChangeExpiresAt: null,
      deletionRequestedAt: options.deletionRequestedAt ?? null,
    })),
    markDeletionRequested: vi.fn(async () => NOW),
    cancelDeletionRequested: vi.fn(async () => undefined),
    listSessions: vi.fn(async () => [
      {
        id: "current",
        createdAt,
        updatedAt: createdAt,
        expiresAt: new Date(NOW.getTime() + 86_400_000),
        ipAddress: null,
        userAgent: null,
        lastPasswordAuthAt: null,
        isCurrent: true,
      },
    ]),
  };
  const answers: Answers = {
    bid: { product: "bid", blockers: [] },
    shop: { product: "shop", blockers: [] },
    ...options.answers,
  };
  const products = {
    check: vi.fn(async (product: "bid" | "shop") => {
      const answer = answers[product];
      if (answer instanceof Error) throw answer;
      return answer as ProductDeletionEligibility;
    }),
  };
  const onProductUnavailable = vi.fn();
  const notices = { notify: vi.fn(async () => undefined) };
  const service = new AccountDeletionService(
    { operations: operations as never, products, notices, onProductUnavailable },
    () => NOW,
  );
  return { service, operations, products, onProductUnavailable, notices };
}

describe("AccountDeletionService.status", () => {
  it("is clear for every product when nothing is in the way", async () => {
    const { service, products } = setup();
    expect(await service.status(SUBJECT)).toEqual({
      requestedAt: null,
      products: [
        { product: "bid", state: "clear", blockers: [] },
        { product: "shop", state: "clear", blockers: [] },
      ],
    });
    expect(products.check).toHaveBeenCalledTimes(2);
  });

  it("keeps each product's blockers together", async () => {
    const { service } = setup({
      answers: { bid: { product: "bid", blockers: [BLOCKER] } },
    });
    const status = await service.status(SUBJECT);
    expect(status?.products[0]).toEqual({ product: "bid", state: "blocked", blockers: [BLOCKER] });
    expect(status?.products[1]?.state).toBe("clear");
  });

  it("reports a product that cannot be asked as unavailable, and says why to the log", async () => {
    const cause = new Error("timeout");
    const { service, onProductUnavailable } = setup({ answers: { shop: cause } });
    const status = await service.status(SUBJECT);
    expect(status?.products[1]).toEqual({ product: "shop", state: "unavailable", blockers: [] });
    expect(onProductUnavailable).toHaveBeenCalledWith("shop", cause);
  });

  it("asks the products in parallel, so one slow product does not delay the other", async () => {
    const { service, products } = setup();
    const order: string[] = [];
    products.check.mockImplementation(async (product) => {
      order.push(`start ${product}`);
      await new Promise((resolve) => setTimeout(resolve, product === "bid" ? 20 : 0));
      order.push(`end ${product}`);
      return { product, blockers: [] };
    });
    await service.status(SUBJECT);
    expect(order.slice(0, 2)).toEqual(["start bid", "start shop"]);
  });

  it("includes when deletion was requested", async () => {
    const { service } = setup({ deletionRequestedAt: new Date("2026-10-01T09:00:00.000Z") });
    expect((await service.status(SUBJECT))?.requestedAt).toBe("2026-10-01T09:00:00.000Z");
  });

  it("is null for a person who no longer exists", async () => {
    const { service, operations } = setup();
    operations.readSecurityStatus.mockResolvedValueOnce(null as never);
    expect(await service.status(SUBJECT)).toBeNull();
  });
});

describe("AccountDeletionService.requestDeletion", () => {
  it("starts the grace period when every product is clear (all clear)", async () => {
    const { service, operations } = setup();
    expect(await service.requestDeletion(SUBJECT)).toEqual({
      outcome: "requested",
      requestedAt: NOW.toISOString(),
    });
    expect(operations.markDeletionRequested).toHaveBeenCalledWith(SUBJECT);
  });

  it("emails the person the day the grace period ends", async () => {
    const { service, notices } = setup();
    await service.requestDeletion(SUBJECT);
    expect(notices.notify).toHaveBeenCalledWith({
      kind: "account_deletion_requested",
      userId: SUBJECT,
      at: NOW,
      effectiveAt: new Date("2026-11-22T12:00:00.000Z"),
    });
  });

  it("sends no email when a product blocks the request", async () => {
    const { service, notices } = setup({
      answers: { bid: { product: "bid", blockers: [BLOCKER] } },
    });
    await service.requestDeletion(SUBJECT);
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("changes nothing when a product has blockers", async () => {
    const { service, operations } = setup({
      answers: { shop: { product: "shop", blockers: [BLOCKER] } },
    });
    const outcome = await service.requestDeletion(SUBJECT);
    expect(outcome?.outcome).toBe("not_eligible");
    expect(operations.markDeletionRequested).not.toHaveBeenCalled();
  });

  it.each(["bid", "shop"] as const)("never deletes while %s is unreachable", async (down) => {
    const { service, operations } = setup({ answers: { [down]: new Error("down") } });
    const outcome = await service.requestDeletion(SUBJECT);
    expect(outcome).toMatchObject({ outcome: "not_eligible" });
    expect(operations.markDeletionRequested).not.toHaveBeenCalled();
  });

  it("does not restart the grace period for a person who already asked", async () => {
    const { service, operations } = setup({
      deletionRequestedAt: new Date("2026-10-01T09:00:00.000Z"),
    });
    expect(await service.requestDeletion(SUBJECT)).toEqual({
      outcome: "already_requested",
      requestedAt: "2026-10-01T09:00:00.000Z",
    });
    expect(operations.markDeletionRequested).not.toHaveBeenCalled();
  });

  it("is null for a person who no longer exists", async () => {
    const { service, operations } = setup();
    operations.readSecurityStatus.mockResolvedValueOnce(null as never);
    expect(await service.requestDeletion(SUBJECT)).toBeNull();
  });
});

describe("AccountDeletionService.requestDeletionWithStepUp", () => {
  it("proceeds after a recent sign-in", async () => {
    const { service, operations } = setup();
    expect(await service.requestDeletionWithStepUp(SUBJECT, "current")).toMatchObject({
      ok: true,
      outcome: { outcome: "requested" },
    });
    expect(operations.markDeletionRequested).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["an old sign-in", "current", 3_600_000],
    ["someone else's sign-in", "someone-elses", 1_000],
  ])("asks to sign in again for %s, before asking any product", async (_label, sid, ageMs) => {
    const { service, products, operations } = setup({ sessionAgeMs: ageMs });
    expect(await service.requestDeletionWithStepUp(SUBJECT, sid)).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(products.check).not.toHaveBeenCalled();
    expect(operations.markDeletionRequested).not.toHaveBeenCalled();
  });

  it("re-checks eligibility at the moment of the request", async () => {
    const { service, products } = setup();
    await service.requestDeletionWithStepUp(SUBJECT, "current");
    expect(products.check).toHaveBeenCalledTimes(2);
  });
});

describe("AccountDeletionService.cancelDeletion", () => {
  it("cancels a deletion in its grace period with any live sign-in", async () => {
    const { service, operations, notices } = setup({
      deletionRequestedAt: new Date("2026-10-01T09:00:00.000Z"),
      sessionAgeMs: 3_600_000,
    });
    expect(await service.cancelDeletion(SUBJECT, "current")).toEqual({
      ok: true,
      outcome: "cancelled",
    });
    expect(operations.cancelDeletionRequested).toHaveBeenCalledWith(SUBJECT);
    expect(notices.notify).toHaveBeenCalledWith({
      kind: "account_deletion_cancelled",
      userId: SUBJECT,
      at: NOW,
    });
  });

  it("does nothing, and publishes nothing, when no deletion was requested", async () => {
    const { service, operations, notices } = setup();
    expect(await service.cancelDeletion(SUBJECT, "current")).toEqual({
      ok: true,
      outcome: "not_requested",
    });
    expect(operations.cancelDeletionRequested).not.toHaveBeenCalled();
    expect(notices.notify).not.toHaveBeenCalled();
  });

  it("needs a live sign-in of the person's own", async () => {
    const { service, operations } = setup({
      deletionRequestedAt: new Date("2026-10-01T09:00:00.000Z"),
    });
    expect(await service.cancelDeletion(SUBJECT, "unknown")).toEqual({
      ok: false,
      reason: "reauth_required",
    });
    expect(operations.cancelDeletionRequested).not.toHaveBeenCalled();
  });
});
