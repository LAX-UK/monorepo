import type { Database } from "@auction/db";
import { shopParty, shopUserProfile } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { isPayeeConnectReady } from "@auction/shop-domain";
import { assertConnectUrlAllowed } from "@auction/stripe-connect";
import { eq } from "drizzle-orm";
import type {
  ShopConnectAccountPrefill,
  ShopConnectGateway,
} from "../application/ports/shop-connect.gateway.js";
import type {
  ShopPayeeConnectPort,
  ShopPayeeConnectStatus,
} from "../application/ports/shop-payee-connect.port.js";
import { ShopApiError } from "../errors/shop-api-error.js";
import type {
  ShopPayeeConnectAccountRepository,
  ShopPayeeConnectAccountRow,
} from "./drizzle-shop-payee-connect-account.repository.js";
import { resolveShopUserEmail } from "./resolve-shop-user-email.js";

const NO_ACCOUNT_STATUS: ShopPayeeConnectStatus = {
  stripeAccountId: null,
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
    stripeAccountId: row.stripeConnectAccountId,
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
  storefrontOrigin: string;
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

  async function requirePayeePartyIds(identitySubjectId: string): Promise<[string, ...string[]]> {
    const partyIds = await accounts.payeePartyIdsForSubject(identitySubjectId);
    const [first, ...rest] = partyIds;
    if (!first) {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.NOT_FOUND,
        "No shop party linked to this account",
        404,
      );
    }
    return [first, ...rest];
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
    const partyIds = await requirePayeePartyIds(identitySubjectId);
    const existing = await accounts.findForPartyIds(partyIds);
    if (existing) return existing;
    const payeePartyId = partyIds[0];
    const { stripeAccountId } = await gateway.createAccount(
      await loadPrefill(identitySubjectId, payeePartyId),
    );
    await accounts.insertIfAbsent(payeePartyId, stripeAccountId);
    const row = await accounts.findForPartyIds(partyIds);
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
      assertConnectUrlAllowed(url, options.storefrontOrigin, {
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
      const partyIds = await requirePayeePartyIds(identitySubjectId);
      const row = await accounts.findForPartyIds(partyIds);
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
          : await accounts.findForPartyIds(await requirePayeePartyIds(identitySubjectId));
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
