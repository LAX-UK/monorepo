import { describe, expect, it, vi } from "vitest";
import { SellerIdentityReader } from "./seller-identity.reader.js";

function reader(entity: unknown, kycStatus: string | null = null) {
  const getUserKycState = vi
    .fn()
    .mockResolvedValue(kycStatus ? { kycStatus, kycVerifiedAt: null } : null);
  return {
    getUserKycState,
    reader: new SellerIdentityReader(
      { findById: vi.fn().mockResolvedValue(entity) } as never,
      { getUserKycState } as never,
    ),
  };
}

describe("SellerIdentityReader", () => {
  it("reads a personal account's identity from its person's verification", async () => {
    const { reader: r, getUserKycState } = reader(
      { kind: "individual", createdByUserId: "u1", status: "approved" },
      "approved",
    );
    expect(await r.factsFor("le-1")).toEqual({ kind: "individual", kycStatus: "approved" });
    expect(getUserKycState).toHaveBeenCalledWith("u1");
  });

  it("reads an organisation's from its document review", async () => {
    const { reader: r, getUserKycState } = reader({
      kind: "organisation",
      createdByUserId: "u1",
      status: "under_review",
    });
    expect(await r.factsFor("le-1")).toEqual({ kind: "organisation", status: "under_review" });
    expect(getUserKycState).not.toHaveBeenCalled();
  });

  it("knows nothing about an account that does not exist", async () => {
    expect(await reader(null).reader.factsFor("missing")).toBeNull();
  });
});
