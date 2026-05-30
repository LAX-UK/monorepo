import { connectGapPayoutsBannerCopy } from "@/lib/connect/connect-gap-copy";
import {
  type ConnectGapState,
  type ConnectLegalEntityFields,
  getConnectGapState,
  isSellerConnectReady,
  shouldSkipConnect,
} from "@auction/connect";

export type SellerConnectPresentation = {
  showBanner: boolean;
  bannerCopy: { title: string; description: string } | null;
  gap: ConnectGapState | null;
  connectReady: boolean;
};

const noBannerReady: SellerConnectPresentation = {
  showBanner: false,
  bannerCopy: null,
  gap: null,
  connectReady: true,
};

/** Server-safe: whether payouts/overview should surface connect gap UI. */
export function resolveSellerConnectPresentation(input: {
  connectEnforced: boolean;
  entity: ConnectLegalEntityFields | null;
  kycApproved?: boolean;
}): SellerConnectPresentation {
  const { connectEnforced, entity, kycApproved = true } = input;
  if (!connectEnforced || !entity) {
    return noBannerReady;
  }

  if (shouldSkipConnect(entity)) {
    return {
      showBanner: false,
      bannerCopy: null,
      gap: getConnectGapState(entity, { kycApproved }),
      connectReady: true,
    };
  }

  const gap = getConnectGapState(entity, { kycApproved });
  const connectReady = isSellerConnectReady(entity);

  if (connectReady) {
    return { showBanner: false, bannerCopy: null, gap, connectReady: true };
  }

  return {
    showBanner: true,
    bannerCopy: connectGapPayoutsBannerCopy(gap),
    gap,
    connectReady: false,
  };
}

/** Map API legal entity row to Connect readiness fields. */
export function legalEntityToConnectFields(entity: {
  status: string;
  stripeConnectAccountId?: string | null;
  stripeConnectChargesEnabled?: boolean;
  stripeConnectPayoutsEnabled: boolean;
  stripeConnectRequirementsCurrentlyDue?: string[] | null;
  stripeConnectDisabledReason?: string | null;
  isLaxManaged?: boolean;
}): ConnectLegalEntityFields {
  const fields: ConnectLegalEntityFields = {
    status: entity.status,
    stripeConnectAccountId: entity.stripeConnectAccountId ?? null,
    stripeConnectPayoutsEnabled: entity.stripeConnectPayoutsEnabled,
    stripeConnectRequirementsCurrentlyDue: entity.stripeConnectRequirementsCurrentlyDue ?? [],
    stripeConnectDisabledReason: entity.stripeConnectDisabledReason ?? null,
  };
  if (entity.stripeConnectChargesEnabled !== undefined) {
    fields.stripeConnectChargesEnabled = entity.stripeConnectChargesEnabled;
  }
  if (entity.isLaxManaged !== undefined) {
    fields.isLaxManaged = entity.isLaxManaged;
  }
  return fields;
}
