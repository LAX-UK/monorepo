import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

export function SuspendedNotice({ className }: { className?: string }) {
  return (
    <Alert
      className={`border-error/30 bg-error-container/10 text-on-surface ring-1 ring-error/15 ${className ?? ""}`}
    >
      <AlertTitle className="text-on-surface">Account suspended</AlertTitle>
      <AlertDescription className="text-on-surface-variant">
        Your account is suspended. Contact support to restore bidding.
      </AlertDescription>
    </Alert>
  );
}
