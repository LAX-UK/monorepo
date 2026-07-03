import type { ArtistStatus, ItemSubmissionStatus, PaymentStatus, SaleStatus } from "@auction/types";
import {
  artistStatusLabel,
  artistStatusToBadgeVariant,
  categoryLifecycleLabel,
  categoryLifecycleToBadgeVariant,
  lotStatusLabel,
  lotStatusToBadgeVariant,
  saleStatusLabel,
  saleStatusToBadgeVariant,
  submissionStatusLabel,
  submissionStatusToBadgeVariant,
} from "./catalog";
import type { CategoryLifecycleStatus } from "./catalog";
import {
  amlDecisionOutcomeLabel,
  amlDecisionOutcomeToBadgeVariant,
  amlHoldStatusLabel,
  amlHoldStatusToBadgeVariant,
  amlMatchStatusLabel,
  amlMatchStatusToBadgeVariant,
  amlMonitorStatusLabel,
  amlMonitorStatusToBadgeVariant,
  disputeStatusLabel,
  disputeStatusToBadgeVariant,
  legalEntityStatusLabel,
  legalEntityStatusToBadgeVariant,
  sofCaseStatusLabel,
  sofCaseStatusToBadgeVariant,
} from "./compliance";
import type { AdminStatusDomain, StatusBadgeVariant } from "./core";
import {
  paymentStatusLabel,
  paymentStatusToBadgeVariant,
  payoutStatusLabel,
  payoutStatusToBadgeVariant,
} from "./finance";
import {
  conditionReportStatusLabel,
  conditionReportStatusToBadgeVariant,
  emailOutboxStatusLabel,
  emailOutboxStatusToBadgeVariant,
  lotFulfilmentStatusLabel,
  lotFulfilmentStatusToBadgeVariant,
  onsiteEventStatusLabel,
  onsiteEventStatusToBadgeVariant,
  saleroomSessionStatusLabel,
  saleroomSessionStatusToBadgeVariant,
  suppressionReasonLabel,
  suppressionReasonToBadgeVariant,
} from "./operations";
import type { ConditionReportStatus } from "./operations";
import {
  invitationStatusLabel,
  invitationStatusToBadgeVariant,
  inviteLifecycleLabel,
  inviteLifecycleToBadgeVariant,
  kycStatusLabel,
  kycStatusToBadgeVariant,
  registrationStatusLabel,
  registrationStatusToBadgeVariant,
  userAccountStatusLabel,
  userAccountStatusToBadgeVariant,
} from "./people";

type AdminStatusResolver = {
  label: (status: string) => string;
  variant: (status: string) => StatusBadgeVariant;
};

function mapLabel<T extends string>(
  map: Record<T, string>,
  status: string,
  fallback?: (status: string) => string,
): string {
  return map[status as T] ?? fallback?.(status) ?? status;
}

function underscoreFallback(status: string): string {
  return status.replaceAll("_", " ");
}

export const ADMIN_STATUS_REGISTRY: Record<AdminStatusDomain, AdminStatusResolver> = {
  sale: {
    label: (status) => mapLabel(saleStatusLabel, status),
    variant: (status) => saleStatusToBadgeVariant(status as SaleStatus),
  },
  lot: {
    label: (status) => mapLabel(lotStatusLabel, status),
    variant: (status) => lotStatusToBadgeVariant(status),
  },
  artist: {
    label: (status) => mapLabel(artistStatusLabel, status),
    variant: (status) => artistStatusToBadgeVariant(status as ArtistStatus),
  },
  submission: {
    label: (status) => mapLabel(submissionStatusLabel, status),
    variant: (status) => submissionStatusToBadgeVariant(status as ItemSubmissionStatus),
  },
  payment: {
    label: (status) => mapLabel(paymentStatusLabel, status, underscoreFallback),
    variant: (status) => paymentStatusToBadgeVariant(status as PaymentStatus),
  },
  amlMatch: {
    label: (status) => amlMatchStatusLabel[status] ?? underscoreFallback(status),
    variant: (status) => amlMatchStatusToBadgeVariant(status),
  },
  amlDecision: {
    label: (status) => amlDecisionOutcomeLabel[status] ?? underscoreFallback(status),
    variant: (status) => amlDecisionOutcomeToBadgeVariant(status),
  },
  amlMonitor: {
    label: (status) => amlMonitorStatusLabel[status] ?? underscoreFallback(status),
    variant: (status) => amlMonitorStatusToBadgeVariant(status),
  },
  amlHold: {
    label: (status) => amlHoldStatusLabel[status] ?? underscoreFallback(status),
    variant: (status) => amlHoldStatusToBadgeVariant(status),
  },
  sofCase: {
    label: (status) => sofCaseStatusLabel[status] ?? underscoreFallback(status),
    variant: (status) => sofCaseStatusToBadgeVariant(status),
  },
  payout: {
    label: (status) => mapLabel(payoutStatusLabel, status, underscoreFallback),
    variant: (status) => payoutStatusToBadgeVariant(status),
  },
  invitation: {
    label: (status) => mapLabel(invitationStatusLabel, status),
    variant: (status) => invitationStatusToBadgeVariant(status),
  },
  inviteLifecycle: {
    label: (status) => mapLabel(inviteLifecycleLabel, status),
    variant: (status) => inviteLifecycleToBadgeVariant(status),
  },
  user: {
    label: (status) => mapLabel(userAccountStatusLabel, status),
    variant: (status) => userAccountStatusToBadgeVariant(status),
  },
  emailOutbox: {
    label: (status) => mapLabel(emailOutboxStatusLabel, status),
    variant: (status) => emailOutboxStatusToBadgeVariant(status),
  },
  suppression: {
    label: (status) => mapLabel(suppressionReasonLabel, status),
    variant: (status) => suppressionReasonToBadgeVariant(status),
  },
  registration: {
    label: (status) => mapLabel(registrationStatusLabel, status),
    variant: (status) => registrationStatusToBadgeVariant(status),
  },
  fulfilment: {
    label: (status) => mapLabel(lotFulfilmentStatusLabel, status, underscoreFallback),
    variant: (status) => lotFulfilmentStatusToBadgeVariant(status),
  },
  conditionReport: {
    label: (status) => {
      if (status === "pending") return "Requested";
      return (
        conditionReportStatusLabel[status as ConditionReportStatus] ?? underscoreFallback(status)
      );
    },
    variant: (status) => conditionReportStatusToBadgeVariant(status),
  },
  saleroomSession: {
    label: (status) => mapLabel(saleroomSessionStatusLabel, status),
    variant: (status) => saleroomSessionStatusToBadgeVariant(status),
  },
  kyc: {
    label: (status) => kycStatusLabel(status),
    variant: (status) => kycStatusToBadgeVariant(status),
  },
  legalEntity: {
    label: (status) => mapLabel(legalEntityStatusLabel, status, underscoreFallback),
    variant: (status) => legalEntityStatusToBadgeVariant(status),
  },
  dispute: {
    label: (status) => mapLabel(disputeStatusLabel, status, underscoreFallback),
    variant: (status) => disputeStatusToBadgeVariant(status),
  },
  category: {
    label: (status) => mapLabel(categoryLifecycleLabel, status),
    variant: (status) => categoryLifecycleToBadgeVariant(status as CategoryLifecycleStatus),
  },
  venue: {
    label: (status) => (status === "archived" ? "Archived" : "Active"),
    variant: (status) => (status === "archived" ? "neutral" : "success"),
  },
  onsiteEvent: {
    label: (status) => onsiteEventStatusLabel[status] ?? underscoreFallback(status),
    variant: (status) => onsiteEventStatusToBadgeVariant(status),
  },
};
