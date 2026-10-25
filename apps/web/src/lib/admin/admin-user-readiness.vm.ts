import { kycStatusPhrase } from "@/lib/admin/admin-user-presenters";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { formatAmlHoldReason } from "@/lib/admin/status-badge-variants";
import { connectGapStageLabel } from "@/lib/connect/connect-gap-copy";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { getConnectGapState } from "@auction/connect";
import type { LegalEntity } from "@auction/types";

export type UserAttentionItem = {
  id: string;
  message: string;
  href: string;
  severity: "critical" | "warning" | "info";
};

export type BuildInput = {
  user: AdminUserDetailPayload;
  legalEntities: LegalEntity[];
  amlScreenings: AdminAmlScreeningRow[];
  canViewAml: boolean;
};

type AttentionSignal = UserAttentionItem & { priority: number };

function countConnectGaps(entities: LegalEntity[]): number {
  return entities.reduce((acc, entity) => {
    const gap = getConnectGapState(entity);
    return acc + (gap.missing.length > 0 ? 1 : 0);
  }, 0);
}

function collectAttentionSignals(input: BuildInput): AttentionSignal[] {
  const { user, legalEntities, amlScreenings, canViewAml } = input;
  const latestAml = amlScreenings[0] ?? null;
  const connectGaps = countConnectGaps(legalEntities);
  const kycStatus = user.kycStatus ?? "";
  const signals: AttentionSignal[] = [];

  if (user.suspendedAt) {
    signals.push({
      id: "suspended",
      priority: 10,
      message: `Account suspended${user.suspendedReason ? ` · ${user.suspendedReason}` : ""}`,
      href: "?tab=overview#profile",
      severity: "critical",
    });
  }

  if (user.amlHoldStatus && user.amlHoldStatus !== "none") {
    const reason = formatAmlHoldReason(user.amlHoldReason);
    signals.push({
      id: "aml-hold",
      priority: 20,
      message: `AML hold active${reason ? ` · ${reason}` : ""}`,
      href: "?tab=overview#profile",
      severity: "critical",
    });
  }

  if (user.deletionRequestedAt) {
    signals.push({
      id: "deletion-requested",
      priority: 30,
      message: `Deletion requested · ${formatAdminUserDate(user.deletionRequestedAt)}`,
      href: "?tab=overview#profile",
      severity: "warning",
    });
  }

  if (canViewAml && latestAml?.reviewStatus === "pending") {
    signals.push({
      id: "aml-review",
      priority: 40,
      message: "Watchlist screening awaiting review",
      href: "?tab=overview#aml",
      severity: "warning",
    });
  }

  if (kycStatus === "pending" || kycStatus === "under_review" || kycStatus === "submitted") {
    signals.push({
      id: "kyc-pending",
      priority: 50,
      message: "Identity check in progress or awaiting a decision",
      href: "?tab=overview#kyc-history",
      severity: "warning",
    });
  } else if (kycStatus === "rejected" || kycStatus === "expired") {
    signals.push({
      id: "kyc-issue",
      priority: 60,
      message: `Identity check ${kycStatusPhrase(kycStatus)}`,
      href: "?tab=overview#kyc-history",
      severity: "warning",
    });
  }

  if (connectGaps > 0) {
    const firstGap = legalEntities.find((e) => getConnectGapState(e).missing.length > 0);
    const stage = firstGap ? connectGapStageLabel(getConnectGapState(firstGap).stage) : "setup";
    signals.push({
      id: "connect-gaps",
      priority: 70,
      message: `Seller setup incomplete on ${connectGaps} entit${connectGaps === 1 ? "y" : "ies"}: ${stage.toLowerCase()}`,
      href: "?tab=overview#legal-entities",
      severity: "warning",
    });
  }

  if (!user.emailVerified) {
    signals.push({
      id: "email-unverified",
      priority: 80,
      message: "Email address not verified",
      href: "?tab=overview#profile",
      severity: "info",
    });
  }

  return signals.sort((a, b) => a.priority - b.priority);
}

export function buildUserAttentionItems(input: BuildInput): UserAttentionItem[] {
  return collectAttentionSignals(input).map(({ id, message, href, severity }) => ({
    id,
    message,
    href,
    severity,
  }));
}
