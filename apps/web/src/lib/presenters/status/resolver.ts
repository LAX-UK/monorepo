import type { LotStatus } from "@auction/types";
import type { DotStatusPillTone } from "@auction/ui";
import { presentationToDotStatus } from "@auction/ui";
import { ADMIN_STATUS_REGISTRY } from "./admin-status-registry";
import { lotStatusLabel, lotStatusToBadgeVariant } from "./catalog";
import type {
  AdminStatusDomain,
  LotStatusContext,
  StatusBadgeVariant,
  StatusDomain,
  StatusPresentation,
  StatusPresentationContext,
} from "./core";

export function adminStatusLabel(domain: AdminStatusDomain, status: string): string {
  return ADMIN_STATUS_REGISTRY[domain]?.label(status) ?? status;
}

export function adminStatusToBadgeVariant(
  domain: AdminStatusDomain,
  status: string,
): StatusBadgeVariant {
  return ADMIN_STATUS_REGISTRY[domain]?.variant(status) ?? "neutral";
}

/** Outcome-aware label + variant for `ended` lots (uses API `winnerId` or list `hasWinner`). */
export function lotEndedPresentation(context?: LotStatusContext): StatusPresentation {
  const winnerId = context?.winnerId;
  const hasWinner = context?.hasWinner;
  if (winnerId != null || hasWinner === true) {
    return { label: "Sold", variant: "success" };
  }
  if (winnerId === null || hasWinner === false) {
    return { label: "Unsold", variant: "neutral" };
  }
  return { label: lotStatusLabel.ended, variant: "neutral" };
}

export function resolveLotStatusPresentation(
  status: LotStatus | string,
  context?: LotStatusContext,
): StatusPresentation {
  const variant = lotStatusToBadgeVariant(status);
  if (status === "ended") {
    return lotEndedPresentation(context);
  }
  const label = lotStatusLabel[status as LotStatus] ?? String(status);
  return { label, variant, dot: status === "active" };
}

export function resolveStatusPresentation(
  domain: StatusDomain,
  status: string,
  context?: StatusPresentationContext,
): StatusPresentation {
  if (domain === "lot") {
    return resolveLotStatusPresentation(status, context?.lot);
  }
  const label = adminStatusLabel(domain, status);
  const variant = adminStatusToBadgeVariant(domain, status);
  return { label, variant, dot: variant === "live" };
}

export type DotStatusPresentation = {
  label: string;
  tone: DotStatusPillTone;
};

/** Resolver output → Tag-Review chip props. */
export function resolveDotStatusPresentation(
  domain: StatusDomain,
  status: string,
  context?: StatusPresentationContext,
): DotStatusPresentation {
  return presentationToDotStatus(resolveStatusPresentation(domain, status, context));
}

export function resolveLotDotStatusPresentation(
  status: LotStatus | string,
  context?: LotStatusContext,
): DotStatusPresentation {
  return presentationToDotStatus(resolveLotStatusPresentation(status, context));
}

export type {
  AdminStatusDomain,
  LotStatusContext,
  StatusDomain,
  StatusPresentation,
  StatusPresentationContext,
};
