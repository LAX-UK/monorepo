vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminLegalEntityById: vi.fn(),
}));
vi.mock("@/lib/data/http/stripe-connect.server", () => ({
  getServerStripeConnectClientConfig: vi.fn(),
}));

import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getServerStripeConnectClientConfig } from "@/lib/data/http/stripe-connect.server";
import type { LegalEntity, Lot } from "@auction/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildConnectRequiredByLotId,
  connectRequiredFromLots,
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
    isLaxManaged: false,
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

  it("treats LAX-managed inventory as ready", () => {
    expect(isSellerConnectReady(readySeller({ isLaxManaged: true, status: "approved" }))).toBe(
      true,
    );
  });
});

describe("isStripeConnectEnforcedOnPublish", () => {
  beforeEach(() => {
    vi.mocked(getServerStripeConnectClientConfig).mockReset();
  });

  it("reads connectEnforced from API client-config", async () => {
    vi.mocked(getServerStripeConnectClientConfig).mockResolvedValue({
      publishableKey: "pk_test",
      connectEnforced: false,
    });
    expect(await isStripeConnectEnforcedOnPublish()).toBe(false);

    vi.mocked(getServerStripeConnectClientConfig).mockResolvedValue({
      publishableKey: "pk_test",
      connectEnforced: true,
    });
    expect(await isStripeConnectEnforcedOnPublish()).toBe(true);
  });
});

describe("connectRequiredFromLots", () => {
  it("maps API-provided connectRequired flags", () => {
    expect(
      connectRequiredFromLots([
        { id: "a", connectRequired: true },
        { id: "b", connectRequired: false },
      ]),
    ).toEqual({ a: true, b: false });
  });
});

describe("buildConnectRequiredByLotId", () => {
  beforeEach(() => {
    vi.mocked(getAdminLegalEntityById).mockReset();
    vi.mocked(getServerStripeConnectClientConfig).mockResolvedValue({
      publishableKey: null,
      connectEnforced: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses API-provided connectRequired without fetching sellers", async () => {
    const flagged = lot({ connectRequired: true } as Lot & { connectRequired: boolean });
    const record = await buildConnectRequiredByLotId([flagged]);
    expect(record[flagged.id]).toBe(true);
    expect(getAdminLegalEntityById).not.toHaveBeenCalled();
  });

  it("returns all false when enforcement is off", async () => {
    vi.mocked(getServerStripeConnectClientConfig).mockResolvedValue({
      publishableKey: null,
      connectEnforced: false,
    });
    const record = await buildConnectRequiredByLotId([lot()]);
    expect(record[lot().id]).toBe(false);
    expect(getAdminLegalEntityById).not.toHaveBeenCalled();
  });

  it("flags lots whose seller is not connect-ready", async () => {
    vi.mocked(getAdminLegalEntityById).mockResolvedValue(
      readySeller({ stripeConnectPayoutsEnabled: false }),
    );
    const record = await buildConnectRequiredByLotId([lot()]);
    expect(record[lot().id]).toBe(true);
  });

  it("treats missing seller entity as blocked when enforcement is on", async () => {
    vi.mocked(getAdminLegalEntityById).mockResolvedValue(null);
    const record = await buildConnectRequiredByLotId([lot()]);
    expect(record[lot().id]).toBe(true);
  });

  it("skips connect check when lot has no seller", async () => {
    const noSellerLot = lot({ sellerLegalEntityId: undefined });
    const record = await buildConnectRequiredByLotId([noSellerLot]);
    expect(record[noSellerLot.id]).toBe(false);
    expect(getAdminLegalEntityById).not.toHaveBeenCalled();
  });

  it("does not flag lots with LAX-managed sellers", async () => {
    vi.mocked(getAdminLegalEntityById).mockResolvedValue(
      readySeller({ isLaxManaged: true, stripeConnectPayoutsEnabled: false }),
    );
    const record = await buildConnectRequiredByLotId([lot()]);
    expect(record[lot().id]).toBe(false);
  });
});
