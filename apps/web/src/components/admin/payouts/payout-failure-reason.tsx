import { presentPayoutFailureReason } from "@/lib/presenters/status/finance";
import { KeyValueList } from "@auction/staff-ui";

/** Plain-language reason for a payout problem, with the raw code as a small copyable fact. */
export function PayoutFailureReason({ reason }: { reason: string }) {
  const { text, code } = presentPayoutFailureReason(reason);
  return (
    <div className="flex flex-col gap-2">
      <p>{text}</p>
      <KeyValueList items={[{ label: "Reason code", value: code, copyValue: code }]} />
    </div>
  );
}
