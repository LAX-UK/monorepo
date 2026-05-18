import type { ActivityKind, ActivityTone } from "@/lib/data/view-models/dashboard-activity.vm";

export type AdminUserEventPresentation = {
  kind: ActivityKind;
  tone: ActivityTone;
  title: string;
  description?: string;
};

export function presentAdminUserDomainEvent(eventType: string): AdminUserEventPresentation {
  if (eventType === "auth.account_suspended") {
    return { kind: "system", tone: "negative", title: "Account suspended" };
  }
  if (eventType === "auth.account_unsuspended") {
    return { kind: "system", tone: "positive", title: "Account unsuspended" };
  }
  if (eventType.startsWith("kyc.")) {
    return {
      kind: "kyc",
      tone: "warning",
      title: "KYC update",
      description: eventType.replace(/^kyc\./, "").replace(/_/g, " "),
    };
  }
  if (eventType.startsWith("auth.")) {
    return {
      kind: "system",
      tone: "info",
      title: eventType.replace(/^auth\./, "").replace(/_/g, " "),
    };
  }
  if (eventType.startsWith("admin.")) {
    return {
      kind: "system",
      tone: "neutral",
      title: eventType.replace(/^admin\./, "").replace(/_/g, " "),
    };
  }
  return {
    kind: "info",
    tone: "neutral",
    title: eventType.replace(/[._]/g, " "),
  };
}

export function presentAdminUserSession(): AdminUserEventPresentation {
  return { kind: "system", tone: "info", title: "Signed in" };
}

export function isAdminAuditEventType(eventType: string): boolean {
  return eventType.startsWith("auth.") || eventType.startsWith("admin.");
}
