import { PolicyNotice } from "@/components/marketing/policy-notice";

export function SuspendedNotice({ className }: { className?: string }) {
  return (
    <PolicyNotice variant="error" title="Account suspended" {...(className ? { className } : {})}>
      Your account is suspended. Contact support to restore bidding.
    </PolicyNotice>
  );
}
