import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

export function SellerOwnLotNotice({ className }: { className?: string }) {
  return (
    <Alert
      className={`border-primary/30 bg-primary-container/10 text-on-surface ring-1 ring-primary/15 ${className ?? ""}`}
    >
      <AlertTitle className="text-on-surface">This is your listing</AlertTitle>
      <AlertDescription className="text-on-surface-variant">
        You can&apos;t bid on a lot you&apos;re selling. Watch bids arrive in real time in the
        history below.
      </AlertDescription>
    </Alert>
  );
}
