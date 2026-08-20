import { kycStatusPhrase } from "@/lib/admin/admin-user-presenters";
import { formatAdminUserDate } from "@/lib/admin/format-admin-user-date";
import { formatAmlHoldReason } from "@/lib/admin/status-badge-variants";
import { connectGapStageLabel } from "@/lib/connect/connect-gap-copy";
import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import { formatMoney } from "@/lib/format-currency";
import { getConnectGapState } from "@auction/connect";
import type { LegalEntity } from "@auction/types";

export type ReadinessTone = "ready" | "warning" | "blocked";

export type ReadinessNextAction = {
  label: string;
  href: string;
  tone: ReadinessTone;
};

export type UserAttentionItem = {
  id: string;
  message: string;
  href: string;
  severity: "critical" | "warning" | "info";
};

export type AdminUserReadinessSnapshot = {
  identity: {
    emailVerified: boolean;
    kycStatus: string;
    securityStatusAvailable: boolean;
    twoFactorEnabled: boolean;
  };
  compliance: {
    amlHoldActive: boolean;
    amlReviewPending: boolean;
    latestAmlDecision: string | null;
  };
  commerce: {
    legalEntityCount: number;
    connectGapsCount: number;
    lotsWon: number;
    lifetimeSpendLabel: string;
  };
  nextAction: ReadinessNextAction;
};

export type UserDetailRailContext = {
  kycStatus: string;
  emailVerified: boolean;
  amlHoldActive: boolean;
  amlReviewPending: boolean;
  connectGapsCount: number;
  primaryEntity: { id: string; displayName: string } | null;
  canViewAml: boolean;
};

export type BuildInput = {
  user: AdminUserDetailPayload;
  legalEntities: LegalEntity[];
  amlScreenings: AdminAmlScreeningRow[];
  lotsWon: number;
  lifetimeSpend: number;
  canViewAml: boolean;
};

type AttentionSignal = UserAttentionItem & {
  priority: number;
  nextActionLabel: string;
  tone: ReadinessTone;
};

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
      nextActionLabel: "Account suspended — review before taking action",
      href: "?tab=overview#profile",
      severity: "critical",
      tone: "blocked",
    });
  }

  if (user.amlHoldStatus && user.amlHoldStatus !== "none") {
    const reason = formatAmlHoldReason(user.amlHoldReason);
    signals.push({
      id: "aml-hold",
      priority: 20,
      message: `AML hold active${reason ? ` · ${reason}` : ""}`,
      nextActionLabel: "AML hold active — resolve before enabling activity",
      href: "?tab=overview#profile",
      severity: "critical",
      tone: "blocked",
    });
  }

  if (user.deletionRequestedAt) {
    signals.push({
      id: "deletion-requested",
      priority: 30,
      message: `Deletion requested · ${formatAdminUserDate(user.deletionRequestedAt)}`,
      nextActionLabel: "Deletion requested — review account status",
      href: "?tab=overview#profile",
      severity: "warning",
      tone: "warning",
    });
  }

  if (canViewAml && latestAml?.reviewStatus === "pending") {
    signals.push({
      id: "aml-review",
      priority: 40,
      message: "Watchlist screening awaiting review",
      nextActionLabel: "Review AML screening",
      href: "?tab=overview#aml",
      severity: "warning",
      tone: "warning",
    });
  }

  if (kycStatus === "pending" || kycStatus === "under_review" || kycStatus === "submitted") {
    signals.push({
      id: "kyc-pending",
      priority: 50,
      message: "KYC verification in progress or awaiting decision",
      nextActionLabel: "Wait for KYC decision",
      href: "?tab=overview#kyc-history",
      severity: "warning",
      tone: "warning",
    });
  } else if (kycStatus === "rejected" || kycStatus === "expired") {
    signals.push({
      id: "kyc-issue",
      priority: 60,
      message: `KYC ${kycStatusPhrase(kycStatus)}`,
      nextActionLabel: `KYC ${kycStatusPhrase(kycStatus)} — follow up with client`,
      href: "?tab=overview#kyc-history",
      severity: "warning",
      tone: "warning",
    });
  }

  if (connectGaps > 0) {
    const firstGap = legalEntities.find((e) => getConnectGapState(e).missing.length > 0);
    const stage = firstGap ? connectGapStageLabel(getConnectGapState(firstGap).stage) : "setup";
    signals.push({
      id: "connect-gaps",
      priority: 70,
      message: `Seller setup incomplete on ${connectGaps} entit${connectGaps === 1 ? "y" : "ies"}`,
      nextActionLabel: `Seller setup incomplete (${connectGaps}) · ${stage}`,
      href: "?tab=overview#legal-entities",
      severity: "warning",
      tone: "warning",
    });
  }

  if (!user.emailVerified) {
    signals.push({
      id: "email-unverified",
      priority: 80,
      message: "Email address not verified",
      nextActionLabel: "Email not verified",
      href: "?tab=overview#profile",
      severity: "info",
      tone: "warning",
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

export function buildAdminUserReadinessNextAction(input: BuildInput): ReadinessNextAction {
  const top = collectAttentionSignals(input)[0];
  if (!top) {
    return {
      label: "Ready — no blocking issues",
      href: "?tab=overview",
      tone: "ready",
    };
  }

  return {
    label: top.nextActionLabel,
    href: top.href,
    tone: top.tone,
  };
}

export function buildAdminUserReadinessSnapshot(input: BuildInput): AdminUserReadinessSnapshot {
  const { user, legalEntities, amlScreenings, lotsWon, lifetimeSpend, canViewAml } = input;
  const latestAml = amlScreenings[0] ?? null;

  return {
    identity: {
      emailVerified: user.emailVerified,
      kycStatus: user.kycStatus ?? "unknown",
      securityStatusAvailable: user.securityStatusAvailable,
      twoFactorEnabled: user.twoFactorEnabled,
    },
    compliance: {
      amlHoldActive: Boolean(user.amlHoldStatus && user.amlHoldStatus !== "none"),
      amlReviewPending: canViewAml && latestAml?.reviewStatus === "pending",
      latestAmlDecision: canViewAml ? (latestAml?.decisionOutcome ?? null) : null,
    },
    commerce: {
      legalEntityCount: legalEntities.length,
      connectGapsCount: countConnectGaps(legalEntities),
      lotsWon,
      lifetimeSpendLabel: lifetimeSpend > 0 ? formatMoney(lifetimeSpend.toFixed(2)) : "—",
    },
    nextAction: buildAdminUserReadinessNextAction(input),
  };
}

export function buildUserDetailRailContext(input: BuildInput): UserDetailRailContext {
  const { user, legalEntities, amlScreenings, canViewAml } = input;
  const latestAml = amlScreenings[0] ?? null;
  const primary = legalEntities[0] ?? null;

  return {
    kycStatus: user.kycStatus ?? "unknown",
    emailVerified: user.emailVerified,
    amlHoldActive: Boolean(user.amlHoldStatus && user.amlHoldStatus !== "none"),
    amlReviewPending: canViewAml && latestAml?.reviewStatus === "pending",
    connectGapsCount: countConnectGaps(legalEntities),
    primaryEntity: primary ? { id: primary.id, displayName: primary.displayName } : null,
    canViewAml,
  };
}
