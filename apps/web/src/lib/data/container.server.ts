import "server-only";

export { getWriteContainer, type WriteServiceContainer } from "./write-container.server";

import { getServerMyAddresses } from "@/lib/data/http/addresses.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import {
  getServerMyArtistFollows,
  getServerMyBids,
  getServerMyPortfolio,
  getServerMyWatchlist,
} from "@/lib/data/http/dashboard.server";
import { getServerKycStatusSummary, postServerKycSession } from "@/lib/data/http/kyc.server";
import { getServerMyLegalEntityMemberships } from "@/lib/data/http/legal-entities.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerMyNotificationPreferences } from "@/lib/data/http/notification-preferences.server";
import { getServerMyNotifications } from "@/lib/data/http/notifications.server";
import { getServerOrgOnboardingResume } from "@/lib/data/http/org-onboarding.server";
import {
  getServerLotFulfilmentForWinner,
  getServerMyPayments,
} from "@/lib/data/http/payments.server";
import { getServerSaleWithLots, getServerSalesList } from "@/lib/data/http/sales.server";
import {
  getServerPayoutPreviewNextForLegalEntity,
  getServerPayoutsListForLegalEntity,
} from "@/lib/data/http/seller-payouts.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerMySessions } from "@/lib/data/http/sessions.server";
import { getServerStripeConnectStatus } from "@/lib/data/http/stripe-connect.server";
import { getMySubmissions, getSubmissionForUser } from "@/lib/data/http/submissions.server";
import type {
  DashboardActiveLotsReader,
  DashboardAddressesReader,
  DashboardArtistFollowReader,
  DashboardBidsReader,
  DashboardBuyerLotReader,
  DashboardCategoriesReader,
  DashboardKycReader,
  DashboardLegalEntitiesReader,
  DashboardNotificationPreferencesReader,
  DashboardNotificationsReader,
  DashboardOrgOnboardingReader,
  DashboardPaymentsReader,
  DashboardPortfolioReader,
  DashboardSalesReader,
  DashboardSellerLotReader,
  DashboardSellerPayoutsReader,
  DashboardSessionReader,
  DashboardSessionsReader,
  DashboardStripeConnectReader,
  DashboardSubmissionsReader,
  DashboardWatchlistReader,
} from "@/lib/data/readers/dashboard-readers";
import type { LiveSaleReader } from "@/lib/data/readers/marketing-readers";

export type ServerDataContainer = {
  session: DashboardSessionReader;
  kyc: DashboardKycReader;
  notifications: DashboardNotificationsReader;
  notificationPreferences: DashboardNotificationPreferencesReader;
  addresses: DashboardAddressesReader;
  legalEntities: DashboardLegalEntitiesReader;
  submissions: DashboardSubmissionsReader;
  orgOnboarding: DashboardOrgOnboardingReader;
  categories: DashboardCategoriesReader;
  buyerLots: DashboardBuyerLotReader;
  sellerLots: DashboardSellerLotReader;
  bids: DashboardBidsReader;
  portfolio: DashboardPortfolioReader;
  watchlist: DashboardWatchlistReader;
  artistFollow: DashboardArtistFollowReader;
  activeLots: DashboardActiveLotsReader;
  payments: DashboardPaymentsReader;
  sales: DashboardSalesReader;
  stripeConnect: DashboardStripeConnectReader;
  sellerPayouts: DashboardSellerPayoutsReader;
  authSessions: DashboardSessionsReader;
  liveSale: LiveSaleReader;
};

/** Composition root (DIP): server pages depend on this container, not on `fetch` / `hc` directly.
 */
export async function getServerDataContainer(): Promise<ServerDataContainer> {
  const lotReader = await getServerLotReader();
  const categoryReader = await getServerCategoryReader();
  return {
    session: { getCurrent: getServerSessionUser },
    kyc: { getSummary: getServerKycStatusSummary, startSession: postServerKycSession },
    notifications: { listMine: getServerMyNotifications },
    notificationPreferences: { getMine: getServerMyNotificationPreferences },
    addresses: { listMine: getServerMyAddresses },
    legalEntities: { listMine: getServerMyLegalEntityMemberships },
    submissions: { listMine: getMySubmissions, getMineById: getSubmissionForUser },
    orgOnboarding: { getResume: getServerOrgOnboardingResume },
    categories: {
      list: () => categoryReader.list(),
      tree: () => categoryReader.tree(),
    },
    buyerLots: {
      getById: (id) => lotReader.getById(id),
    },
    sellerLots: {
      list: (params) => lotReader.list(params),
    },
    bids: { listMine: getServerMyBids },
    portfolio: { listMine: getServerMyPortfolio },
    watchlist: { listMine: getServerMyWatchlist },
    artistFollow: { listMine: getServerMyArtistFollows },
    payments: {
      listMine: getServerMyPayments,
      getLotFulfilmentForWinner: getServerLotFulfilmentForWinner,
    },
    sales: { getWithLots: getServerSaleWithLots },
    stripeConnect: { getStatus: getServerStripeConnectStatus },
    sellerPayouts: {
      listForLegalEntity: getServerPayoutsListForLegalEntity,
      previewNextForLegalEntity: getServerPayoutPreviewNextForLegalEntity,
    },
    authSessions: { listMine: getServerMySessions },
    activeLots: {
      listActivePreview: (limit) => lotReader.list({ status: "active", limit, sort: "endingAsc" }),
    },
    liveSale: {
      peek: async () => {
        try {
          const rows = await getServerSalesList({ status: "active", limit: 1 });
          const row = rows[0];
          if (!row) return null;
          return { id: row.sale.id, title: row.sale.title };
        } catch {
          return null;
        }
      },
    },
  };
}
