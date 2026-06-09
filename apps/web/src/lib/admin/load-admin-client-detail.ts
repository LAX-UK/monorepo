import {
  buildClientSummaryMetrics,
  sumCapturedPayments,
  sumSubmissionTotalsForSellers,
} from "@/lib/admin/admin-user-metrics";
import type { AdminUserSummaryMetrics } from "@/lib/admin/admin-user-metrics";
import {
  type AdminUserReadinessSnapshot,
  type BuildInput,
  type UserAttentionItem,
  type UserDetailRailContext,
  buildAdminUserReadinessSnapshot,
  buildUserAttentionItems,
  buildUserDetailRailContext,
} from "@/lib/admin/admin-user-readiness.vm";
import { loadAdminUserDetail } from "@/lib/admin/load-admin-user-detail";
import {
  type AdminKycSessionRow,
  type AdminPaymentRow,
  type AdminUserBidRow,
  getAdminArtistsByOwnerUserId,
  getAdminLegalEntitiesForUser,
  getAdminLotsWonByUser,
  getAdminPaymentsForUser,
  getAdminUserAmlScreenings,
  getAdminUserBids,
  getAdminUserKycSessions,
} from "@/lib/data/http/admin.server";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  AML_REVIEW_ACCESS,
  CLIENT_BIDS_ACCESS,
  CLIENT_KYC_ACCESS,
  FINANCE_ACCESS,
  USER_MODERATION_ACCESS,
  USER_ROLE_MANAGEMENT_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import {
  type ArtistProfile,
  type LegalEntity,
  type Lot,
  type UserRole,
  userHasAccessTo,
} from "@auction/types";
import { redirect } from "next/navigation";
import { cache } from "react";

export type AdminClientDetailBundle = {
  user: Awaited<ReturnType<typeof loadAdminUserDetail>>;
  linkedArtists: ArtistProfile[];
  payments: AdminPaymentRow[];
  wonLots: Lot[];
  legalEntities: LegalEntity[];
  kycSessions: AdminKycSessionRow[];
  amlScreenings: AdminAmlScreeningRow[];
  canViewAml: boolean;
  canViewFinance: boolean;
  canViewBids: boolean;
  canViewKyc: boolean;
  canManageRoles: boolean;
  canModerate: boolean;
  bids: AdminUserBidRow[];
  lifetimeSpend: number;
  submissionsCount: number;
  amlScreeningBySessionId: Record<string, AdminAmlScreeningRow>;
  readinessSnapshot: AdminUserReadinessSnapshot;
  attentionItems: UserAttentionItem[];
  railContext: UserDetailRailContext;
  summaryMetrics: AdminUserSummaryMetrics;
  legalEntitiesForActions: { id: string; displayName: string }[];
};

export const loadAdminClientDetail = cache(
  async (userId: string): Promise<AdminClientDetailBundle> => {
    const user = await loadAdminUserDetail(userId);
    if (user.role === "staff") {
      redirect(`/admin/staff/${userId}`);
    }

    const sessionUser = await getServerSessionUser();
    const actorRole = (sessionUser?.role ?? "client") as UserRole;
    const actorStaff = sessionUser?.staffRole ?? null;
    const canViewAml =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, AML_REVIEW_ACCESS);
    const canViewFinance =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, FINANCE_ACCESS);
    const canViewBids =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, CLIENT_BIDS_ACCESS);
    const canViewKyc =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, CLIENT_KYC_ACCESS);
    const canManageRoles =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, USER_ROLE_MANAGEMENT_ACCESS);
    const canModerate =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, USER_MODERATION_ACCESS);

    const [
      linkedArtists,
      payments,
      wonLots,
      legalEntities,
      kycSessions,
      amlScreenings,
      bidsResult,
    ] = await Promise.all([
      getAdminArtistsByOwnerUserId(user.id).catch(() => []),
      canViewFinance ? getAdminPaymentsForUser(user.id).catch(() => []) : Promise.resolve([]),
      getAdminLotsWonByUser(user.id).catch(() => []),
      getAdminLegalEntitiesForUser(user.id).catch(() => []),
      canViewKyc ? getAdminUserKycSessions(user.id).catch(() => []) : Promise.resolve([]),
      canViewAml ? getAdminUserAmlScreenings(user.id).catch(() => []) : Promise.resolve([]),
      canViewBids
        ? getAdminUserBids(user.id, { limit: 50, offset: 0 }).catch(() => ({
            rows: [],
            total: 0,
          }))
        : Promise.resolve({ rows: [], total: 0 }),
    ]);

    const [lifetimeSpend, submissionsCount] = await Promise.all([
      canViewFinance ? Promise.resolve(sumCapturedPayments(payments)) : Promise.resolve(0),
      sumSubmissionTotalsForSellers(legalEntities.map((entity) => entity.id)),
    ]);

    const amlScreeningBySessionId = Object.fromEntries(
      amlScreenings.map((screening) => [screening.providerSessionId, screening]),
    );

    const vmInput: BuildInput = {
      user,
      legalEntities,
      amlScreenings,
      lotsWon: wonLots.length,
      lifetimeSpend,
      canViewAml,
    };

    return {
      user,
      linkedArtists,
      payments,
      wonLots,
      legalEntities,
      kycSessions,
      amlScreenings,
      canViewAml,
      canViewFinance,
      canViewBids,
      canViewKyc,
      canManageRoles,
      canModerate,
      bids: bidsResult.rows,
      lifetimeSpend,
      submissionsCount,
      amlScreeningBySessionId,
      readinessSnapshot: buildAdminUserReadinessSnapshot(vmInput),
      attentionItems: buildUserAttentionItems(vmInput),
      railContext: buildUserDetailRailContext(vmInput),
      summaryMetrics: buildClientSummaryMetrics({
        lifetimeSpend,
        lotsWon: wonLots.length,
        submissionsCount,
        memberSinceIso: user.createdAt,
      }),
      legalEntitiesForActions: legalEntities.map((entity) => ({
        id: entity.id,
        displayName: entity.displayName,
      })),
    };
  },
);
