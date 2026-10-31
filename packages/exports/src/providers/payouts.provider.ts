import { entityRoleCan } from "@auction/domain";
import { type PayoutStatus, normalizeUserRoleOrClient } from "@auction/types";
import { canReadAllPayouts, requirePayoutRead } from "./auth.js";
import { AuthzError } from "./authz-error.js";
import { formatPayoutDate, summarizeFilters } from "./export-shared.js";
import type { ILegalEntityRepository } from "./ports/legal-entity-repository.js";
import type { IPayoutRepository } from "./ports/payout-repository.js";
import type { ExportAuthContext, ExportProvider } from "./types.js";

async function assertClientPayoutAccess(
  ctx: ExportAuthContext,
  legalEntityId: string,
  legalEntityRepo: Pick<ILegalEntityRepository, "findActiveMembership">,
): Promise<void> {
  const membership = await legalEntityRepo.findActiveMembership(ctx.userId, legalEntityId);
  if (!membership) {
    throw new AuthzError("Payout export requires membership in the legal entity", 403);
  }
  // Payouts are the seller's money: only the roles that read them may export them.
  if (!entityRoleCan(membership.role, "entity.payouts.read")) {
    throw new AuthzError("Payout export requires a role that reads payouts", 403);
  }
}

type PayoutExportFilters = { legalEntityId?: string; status?: PayoutStatus };

async function resolvePayoutScope(
  ctx: ExportAuthContext,
  filters: PayoutExportFilters,
  legalEntityRepo: Pick<ILegalEntityRepository, "findActiveMembership">,
): Promise<{ legalEntityId?: string; status?: PayoutStatus }> {
  const role = normalizeUserRoleOrClient(ctx.userRole);
  const statusScope = filters.status ? { status: filters.status } : {};

  if (canReadAllPayouts(ctx)) {
    return {
      ...(filters.legalEntityId ? { legalEntityId: filters.legalEntityId } : {}),
      ...statusScope,
    };
  }

  if (role !== "client") {
    throw new AuthzError("Payout export not allowed", 403);
  }

  const legalEntityId = filters.legalEntityId?.trim();
  if (!legalEntityId) {
    throw new AuthzError("Payout export requires legalEntityId", 403);
  }
  await assertClientPayoutAccess(ctx, legalEntityId, legalEntityRepo);
  return { legalEntityId, ...statusScope };
}

export function createPayoutsProvider(
  payoutRepo: Pick<IPayoutRepository, "list" | "countMatching">,
  legalEntityRepo: Pick<ILegalEntityRepository, "findActiveMembership">,
): ExportProvider<PayoutExportFilters> {
  return {
    entityType: "payouts",
    async authorize(ctx, filters) {
      requirePayoutRead(ctx);
      await resolvePayoutScope(ctx, filters, legalEntityRepo);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "periodStart", header: "period_start" },
      { key: "periodEnd", header: "period_end" },
      { key: "grossAmount", header: "gross_amount" },
      { key: "platformFee", header: "platform_fee" },
      { key: "stripeFee", header: "stripe_fee" },
      { key: "netAmount", header: "net_amount" },
      { key: "currency", header: "currency" },
      { key: "status", header: "status" },
    ],
    async estimateCount(ctx, filters) {
      const scope = await resolvePayoutScope(ctx, filters, legalEntityRepo);
      return payoutRepo.countMatching(scope);
    },
    async *streamRows(ctx, filters) {
      const scope = await resolvePayoutScope(ctx, filters, legalEntityRepo);
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const page = await payoutRepo.list({ ...scope, offset, limit: pageSize });
        if (page.length === 0) break;
        for (const p of page) {
          yield {
            id: p.id,
            periodStart: formatPayoutDate(p.periodStart),
            periodEnd: formatPayoutDate(p.periodEnd),
            grossAmount: p.grossAmount,
            platformFee: p.platformFee,
            stripeFee: p.stripeFee,
            netAmount: p.netAmount,
            currency: p.currency,
            status: p.status,
          };
        }
        if (page.length < pageSize) break;
        offset += pageSize;
      }
    },
    filterSummary: (filters) => summarizeFilters(filters as Record<string, unknown>),
  };
}
