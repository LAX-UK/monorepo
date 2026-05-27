import type { LegalEntity, Lot } from "@auction/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminLegalEntityById: vi.fn(),
}));

import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import {
  buildConnectRequiredByLotId,
  isSellerConnectReady,
  isStripeConnectEnforcedOnPublish,
} from "./connect-readiness";

const sellerId = "20000000-0000-4000-8000-000000000002";

function lot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "40000000-0000-4000-8000-000000000004",
    title: "Lot",
    sellerLegalEntityId: sellerId,
    ...overrides,
  } as Lot;
}

function readySeller(overrides: Partial<LegalEntity> = {}): LegalEntity {
  return {
    id: sellerId,
    status: "approved",
    stripeConnectPayoutsEnabled: true,
    stripeConnectRequirementsCurrentlyDue: [],
    ...overrides,
  } as LegalEntity;
}

describe("isSellerConnectReady", () => {
  it("requires approved status, payouts enabled, and no due requirements", () => {
    expect(isSellerConnectReady(readySeller())).toBe(true);
    expect(isSellerConnectReady(readySeller({ status: "under_review" }))).toBe(false);
    expect(isSellerConnectReady(readySeller({ stripeConnectPayoutsEnabled: false }))).toBe(false);
    expect(
      isSellerConnectReady(
        readySeller({ stripeConnectRequirementsCurrentlyDue: ["external_account"] }),
      ),
    ).toBe(false);
  });
});

describe("isStripeConnectEnforcedOnPublish", () => {
  const original = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    if (original === undefined) process.env.STRIPE_SECRET_KEY = "";
    else process.env.STRIPE_SECRET_KEY = original;
  });

  it("is true only when STRIPE_SECRET_KEY is set", () => {
    process.env.STRIPE_SECRET_KEY = "";
    expect(isStripeConnectEnforcedOnPublish()).toBe(false);
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    expect(isStripeConnectEnforcedOnPublish()).toBe(true);
  });
});

describe("buildConnectRequiredByLotId", () => {
  const original = process.env.STRIPE_SECRET_KEY;

  beforeEach(() => {
    vi.mocked(getAdminLegalEntityById).mockReset();
  });

  afterEach(() => {
    if (original === undefined) process.env.STRIPE_SECRET_KEY = "";
    else process.env.STRIPE_SECRET_KEY = original;
  });

  it("returns all false when enforcement is off", async () => {
    process.env.STRIPE_SECRET_KEY = "";
    const record = await buildConnectRequiredByLotId([lot()]);
    expect(record[lot().id]).toBe(false);
    expect(getAdminLegalEntityById).not.toHaveBeenCalled();
  });

  it("flags lots whose seller is not connect-ready", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    vi.mocked(getAdminLegalEntityById).mockResolvedValue(
      readySeller({ stripeConnectPayoutsEnabled: false }),
    );
    const record = await buildConnectRequiredByLotId([lot()]);
    expect(record[lot().id]).toBe(true);
  });

  it("treats missing seller entity as blocked when enforcement is on", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    vi.mocked(getAdminLegalEntityById).mockResolvedValue(null);
    const record = await buildConnectRequiredByLotId([lot()]);
    expect(record[lot().id]).toBe(true);
  });

  it("skips connect check when lot has no seller", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    const noSellerLot = lot({ sellerLegalEntityId: undefined });
    const record = await buildConnectRequiredByLotId([noSellerLot]);
    expect(record[noSellerLot.id]).toBe(false);
    expect(getAdminLegalEntityById).not.toHaveBeenCalled();
  });
});
