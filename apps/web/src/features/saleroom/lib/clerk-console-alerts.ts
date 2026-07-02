import type { ClerkLivePhase } from "@/features/saleroom/lib/clerk-live-phase";
import type { ClerkAlertDefinition } from "@/features/saleroom/types/clerk-console.types";

export type ClerkAlertContext = {
  paddleRosterEmpty: boolean;
  saleStatus?: string;
  livePhase?: ClerkLivePhase;
  pendingTelForLot: number;
  selfServiceConflict: boolean;
  error?: string | null;
  loadWarnings?: string[];
};

const VISIBLE_ALERT_LIMIT = 2;

export function buildClerkConsoleAlertDefinitions(ctx: ClerkAlertContext): ClerkAlertDefinition[] {
  const alerts: ClerkAlertDefinition[] = [];

  if (ctx.error) {
    alerts.push({
      key: "error",
      title: "Could not load saleroom state",
      body: ctx.error,
      variant: "destructive",
      priority: 0,
    });
  }

  for (const [index, warning] of (ctx.loadWarnings ?? []).entries()) {
    alerts.push({
      key: `load-warning-${index}`,
      title: "Partial data loaded",
      body: warning,
      variant: "destructive",
      priority: 1,
    });
  }

  if (ctx.paddleRosterEmpty) {
    alerts.push({
      key: "paddles",
      title: "Check in bidders before going live",
      body: "No paddles assigned yet. Check in bidders so clerks can place in-room bids.",
      variant: "default",
      priority: 10,
    });
  }

  if (ctx.saleStatus && (ctx.saleStatus === "draft" || ctx.saleStatus === "scheduled")) {
    alerts.push({
      key: "sale",
      title: "Sale not live yet",
      body: "Saleroom session controls work best when the sale status is active.",
      variant: "default",
      priority: 11,
    });
  }

  if (ctx.livePhase === "concluded") {
    alerts.push({
      key: "concluded",
      title: "Sale has ended",
      body: "All lots are complete — close the saleroom session when you're ready.",
      variant: "default",
      priority: 11,
    });
  }

  if (ctx.pendingTelForLot > 0) {
    alerts.push({
      key: "tel",
      title: "Telephone requests for current lot",
      body: `${ctx.pendingTelForLot} telephone request${ctx.pendingTelForLot === 1 ? "" : "s"} may need confirmation before the lot opens.`,
      variant: "default",
      priority: 12,
    });
  }

  if (ctx.selfServiceConflict) {
    alerts.push({
      key: "conflict",
      title: "Online + paddle activity detected",
      body: "At least one checked-in paddle has recent self-service bidding — confirm bidders are not double-bidding.",
      variant: "default",
      priority: 13,
    });
  }

  return alerts.sort((a, b) => a.priority - b.priority);
}

export function partitionClerkConsoleAlerts(
  alerts: ClerkAlertDefinition[],
  showAll: boolean,
): { visible: ClerkAlertDefinition[]; hiddenCount: number } {
  if (showAll) {
    return { visible: alerts, hiddenCount: 0 };
  }
  const visible = alerts.slice(0, VISIBLE_ALERT_LIMIT);
  return {
    visible,
    hiddenCount: Math.max(0, alerts.length - visible.length),
  };
}
