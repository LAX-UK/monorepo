import type { AccessMarker } from "@auction/auth";
import { REGISTERED_OIDC_CLIENT_IDS } from "@auction/identity-contracts";
import { describe, expect, it, vi } from "vitest";
import { createAccountAccessClaimsResolver } from "./account-access-claims.js";

function setup(markers: AccessMarker[]) {
  const store = { readSubjectPolicyInputs: vi.fn(async () => ({ markers, policies: [] })) };
  return { store, resolve: createAccountAccessClaimsResolver({ store }) };
}

describe("account access claims", () => {
  it("lists staff platforms in a stable order and ignores org membership", async () => {
    const { resolve } = setup([
      { kind: "staff", product: "shop" },
      { kind: "org_member", legalEntityId: "le_1" },
      { kind: "staff", product: "bid" },
    ]);

    await expect(
      resolve({ subjectId: "usr_1", clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB }),
    ).resolves.toEqual({ lax_staff_platforms: ["bid", "shop"] });
  });

  it("issues an empty list to Account for people without staff access", async () => {
    const { resolve } = setup([]);

    await expect(
      resolve({ subjectId: "usr_1", clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_ACCOUNT_WEB }),
    ).resolves.toEqual({ lax_staff_platforms: [] });
  });

  it("adds nothing for other clients and skips the lookup", async () => {
    const { resolve, store } = setup([{ kind: "staff", product: "bid" }]);

    await expect(
      resolve({ subjectId: "usr_1", clientId: REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_ADMIN }),
    ).resolves.toEqual({});
    expect(store.readSubjectPolicyInputs).not.toHaveBeenCalled();
  });
});
