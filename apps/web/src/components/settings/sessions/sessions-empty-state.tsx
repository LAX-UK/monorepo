import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";

export function SessionsEmptyState() {
  return (
    <DashboardEmptyState
      context="firstUse"
      illustration="users"
      title="No other active sessions"
      description="You are only signed in on this device."
    />
  );
}
