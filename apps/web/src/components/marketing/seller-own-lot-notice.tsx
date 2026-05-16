import { PolicyNotice } from "@/components/marketing/policy-notice";

export function SellerOwnLotNotice({ className }: { className?: string }) {
  return (
    <PolicyNotice
      variant="warning"
      title="This is your listing"
      {...(className ? { className } : {})}
    >
      You can&apos;t bid on a lot you&apos;re selling. Watch bids arrive in real time in the history
      below.
    </PolicyNotice>
  );
}
