import { buildStripeConnectFlagPatch } from "@auction/connect";
import {
  connectSessionComponents,
  createConnectAccountSession,
  createConnectOnboardingLink,
  createConnectTransfer,
  platformCollectedConnectController,
} from "@auction/stripe-connect";
import Stripe from "stripe";
import type {
  ShopConnectAccountFlags,
  ShopConnectGateway,
} from "../application/ports/shop-connect.gateway.js";

/** Bump when account-create params change so Stripe does not replay a cached response. */
const ACCOUNT_CREATE_IDEMPOTENCY_VERSION = "v1";

export function createStripeShopConnectGateway(options: {
  secretKey: string;
  platformKey: string;
}): ShopConnectGateway {
  const stripe = new Stripe(options.secretKey, { typescript: true });

  return {
    async createAccount(prefill) {
      const individual: Stripe.AccountCreateParams.Individual = {};
      if (prefill.email) individual.email = prefill.email;
      if (prefill.firstName) individual.first_name = prefill.firstName;
      if (prefill.lastName) individual.last_name = prefill.lastName;
      const account = await stripe.accounts.create(
        {
          country: "GB",
          controller: platformCollectedConnectController(),
          capabilities: { transfers: { requested: true } },
          business_type: "individual",
          ...(prefill.email ? { email: prefill.email } : {}),
          individual,
          metadata: { shop_party_id: prefill.partyId, platform_key: options.platformKey },
        },
        {
          idempotencyKey: `shop:connect:account:${ACCOUNT_CREATE_IDEMPOTENCY_VERSION}:${options.platformKey}:${prefill.partyId}`,
        },
      );
      return { stripeAccountId: account.id };
    },

    async retrieveAccountFlags(stripeAccountId) {
      return accountFlagsFromStripe(await stripe.accounts.retrieve(stripeAccountId));
    },

    createOnboardingLink(input) {
      return createConnectOnboardingLink(stripe, {
        accountId: input.stripeAccountId,
        returnUrl: input.returnUrl,
        refreshUrl: input.refreshUrl,
      });
    },

    createAccountSession(input) {
      return createConnectAccountSession(stripe, {
        accountId: input.stripeAccountId,
        components: connectSessionComponents(input.surface),
      });
    },

    async createTransfer(input) {
      const transfer = await createConnectTransfer(stripe, {
        amountMinor: input.amountPence,
        currency: "gbp",
        destinationAccountId: input.destinationAccountId,
        transferGroup: `shop_payout:${input.payoutId}`,
        metadata: { shop_payout_id: input.payoutId, platform_key: options.platformKey },
        idempotencyKey: input.idempotencyKey,
      });
      return { transferId: transfer.id };
    },
  };
}

export function accountFlagsFromStripe(account: Stripe.Account): ShopConnectAccountFlags {
  const flags = buildStripeConnectFlagPatch(account);
  return {
    stripeAccountId: account.id,
    chargesEnabled: flags.stripeConnectChargesEnabled,
    payoutsEnabled: flags.stripeConnectPayoutsEnabled,
    requirementsCurrentlyDue: flags.stripeConnectRequirementsCurrentlyDue,
    disabledReason: flags.stripeConnectDisabledReason,
  };
}
