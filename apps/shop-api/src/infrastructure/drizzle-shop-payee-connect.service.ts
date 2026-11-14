import type { Database } from "@auction/db";
import { shopParty, shopUserProfile } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { isPayeeConnectReady } from "@auction/shop-domain";
import { eq, inArray } from "drizzle-orm";
import type {
  ShopConnectAccountPrefill,
  ShopConnectGateway,
} from "../application/ports/shop-connect.gateway.js";
import type {
  ShopPayeeConnectPort,
  ShopPayeeConnectStatus,
} from "../application/ports/shop-payee-connect.port.js";
import {
  type StorefrontOrigins,
  assertStorefrontReturnUrlAllowed,
} from "../domain/storefront-origins.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import type {
  ShopPayeeConnectAccountRepository,
  ShopPayeeConnectAccountRow,
} from "./drizzle-shop-payee-connect-account.repository.js";
import type { PortalPartyScope } from "./portal-party-scope.js";
import { resolveShopUserEmail } from "./resolve-shop-user-email.js";
import { findOrCreateBuyerParty } from "./shop-party.js";

const NO_ACCOUNT_STATUS: ShopPayeeConnectStatus = {
  accountLinked: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  requirementsCurrentlyDue: [],
  disabledReason: null,
  ready: false,
};

function statusFromRow(row: ShopPayeeConnectAccountRow): ShopPayeeConnectStatus {
  const status = {
    payoutsEnabled: row.payoutsEnabled,
    requirementsCurrentlyDue: row.requirementsCurrentlyDue,
    disabledReason: row.disabledReason,
  };
  return {
    accountLinked: true,
    chargesEnabled: row.chargesEnabled,
    ...status,
    ready: isPayeeConnectReady(status),
  };
}

function splitName(name: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0] ?? null, lastName: null };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) ?? null };
}

export function createDrizzleShopPayeeConnectService(options: {
  db: Database;
  accounts: ShopPayeeConnectAccountRepository;
  gateway: ShopConnectGateway | null;
  publishableKey: string | null;
  storefrontOrigins: StorefrontOrigins;
  failClosedConnectUrls: boolean;
}): ShopPayeeConnectPort {
  const { accounts } = options;

  function requireGateway(): ShopConnectGateway {
    if (!options.gateway) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.INTERNAL,
        "Stripe Connect is not configured",
        501,
      );
    }
    return options.gateway;
  }

  /**
   * The parties whose payout account this person may read or manage: only parties they own. An
   * artist profile on a party they do not own is refused outright, so its payout account is
   * reached only by that party's own sign-in.
   */
  async function requirePayeeScope(identitySubjectId: string): Promise<PortalPartyScope> {
    const scope = await accounts.payeeScopeForSubject(identitySubjectId);
    if (scope.artistOnSharedParty) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.CONFLICT,
        "Your payout account is managed by your gallery",
        409,
      );
    }
    if (scope.ownedPartyIds.length === 0) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.NOT_FOUND,
        "No shop party linked to this account",
        404,
      );
    }
    return scope;
  }

  async function ownPartyDisplayName(identitySubjectId: string, partyIds: string[]) {
    const [profile] = await options.db
      .select({ name: shopUserProfile.name })
      .from(shopUserProfile)
      .where(eq(shopUserProfile.identitySubjectId, identitySubjectId))
      .limit(1);
    if (profile?.name?.trim()) return profile.name.trim();
    const [party] = await options.db
      .select({ displayName: shopParty.displayName })
      .from(shopParty)
      .where(inArray(shopParty.id, partyIds))
      .limit(1);
    return party?.displayName ?? "Payee";
  }

  async function loadPrefill(
    identitySubjectId: string,
    partyId: string,
  ): Promise<ShopConnectAccountPrefill> {
    const [profile] = await options.db
      .select({ name: shopUserProfile.name })
      .from(shopUserProfile)
      .where(eq(shopUserProfile.identitySubjectId, identitySubjectId))
      .limit(1);
    const [party] = await options.db
      .select({ displayName: shopParty.displayName })
      .from(shopParty)
      .where(eq(shopParty.id, partyId))
      .limit(1);
    return {
      partyId,
      email: await resolveShopUserEmail(options.db, identitySubjectId),
      ...splitName(profile?.name ?? party?.displayName),
    };
  }

  async function ensureAccount(identitySubjectId: string): Promise<ShopPayeeConnectAccountRow> {
    const gateway = requireGateway();
    const scope = await requirePayeeScope(identitySubjectId);
    const existing = await accounts.findForPartyIds(scope.ownedPartyIds);
    if (existing) return existing;
    // A new account is only ever opened on the person's own party.
    const payeePartyId =
      scope.ownPartyId ??
      (await findOrCreateBuyerParty(
        options.db,
        identitySubjectId,
        await ownPartyDisplayName(identitySubjectId, scope.ownedPartyIds),
      ));
    const { stripeAccountId } = await gateway.createAccount(
      await loadPrefill(identitySubjectId, payeePartyId),
    );
    await accounts.insertIfAbsent(payeePartyId, stripeAccountId);
    const row = await accounts.findForPartyIds([payeePartyId, ...scope.ownedPartyIds]);
    if (!row) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.INTERNAL,
        "Payout account could not be saved",
        500,
      );
    }
    return row;
  }

  function assertReturnUrl(url: string): void {
    try {
      assertStorefrontReturnUrlAllowed(url, options.storefrontOrigins, {
        failClosed: options.failClosedConnectUrls,
      });
    } catch {
      throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Return URL is not allowed", 400);
    }
  }

  return {
    getClientConfig() {
      return {
        publishableKey: options.publishableKey,
        connectConfigured: options.gateway !== null,
      };
    },

    async getStatusForSubject(identitySubjectId) {
      const scope = await requirePayeeScope(identitySubjectId);
      const row = await accounts.findForPartyIds(scope.ownedPartyIds);
      return row ? statusFromRow(row) : NO_ACCOUNT_STATUS;
    },

    async ensureAccountForSubject(identitySubjectId) {
      const row = await ensureAccount(identitySubjectId);
      return { stripeAccountId: row.stripeConnectAccountId };
    },

    async createOnboardingLinkForSubject(identitySubjectId, returnUrl, refreshUrl) {
      assertReturnUrl(returnUrl);
      assertReturnUrl(refreshUrl);
      const row = await ensureAccount(identitySubjectId);
      const link = await requireGateway().createOnboardingLink({
        stripeAccountId: row.stripeConnectAccountId,
        returnUrl,
        refreshUrl,
      });
      return { url: link.url, expiresAt: link.expiresAt.toISOString() };
    },

    async createAccountSessionForSubject(identitySubjectId, surface) {
      const row =
        surface === "onboarding"
          ? await ensureAccount(identitySubjectId)
          : await accounts.findForPartyIds(
              (await requirePayeeScope(identitySubjectId)).ownedPartyIds,
            );
      if (!row) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.CONFLICT,
          "Set up your payout account first",
          409,
        );
      }
      const clientSecret = await requireGateway().createAccountSession({
        stripeAccountId: row.stripeConnectAccountId,
        surface,
      });
      if (!clientSecret) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.INTERNAL,
          "Stripe returned no session secret",
          502,
        );
      }
      return { clientSecret };
    },
  };
}
