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
  getAdminArtistsByOwnerUserId,
  getAdminLegalEntitiesForUser,
  getAdminLotsWonByUser,
  getAdminPaymentsForUser,
  getAdminUserAmlScreenings,
  getAdminUserKycSessions,
} from "@/lib/data/http/admin.server";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { AML_REVIEW_ACCESS } from "@/lib/navigation/staff-nav-access";
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
    const canViewAml =
      sessionUser != null &&
      userHasAccessTo(
        sessionUser.role as UserRole,
        sessionUser.staffRole ?? null,
        AML_REVIEW_ACCESS,
      );

    const [linkedArtists, payments, wonLots, legalEntities, kycSessions, amlScreenings] =
      await Promise.all([
        getAdminArtistsByOwnerUserId(user.id).catch(() => []),
        getAdminPaymentsForUser(user.id).catch(() => []),
        getAdminLotsWonByUser(user.id).catch(() => []),
        getAdminLegalEntitiesForUser(user.id).catch(() => []),
        getAdminUserKycSessions(user.id).catch(() => []),
        canViewAml ? getAdminUserAmlScreenings(user.id).catch(() => []) : Promise.resolve([]),
      ]);

    const [lifetimeSpend, submissionsCount] = await Promise.all([
      Promise.resolve(sumCapturedPayments(payments)),
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
