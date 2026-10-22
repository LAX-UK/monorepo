import { ENQUIRY_STATUS_LABELS, enquiryStatusTone } from "@/server/domain/enquiry-inbox.vm";
import type { EnquiryStatus } from "@auction/shop-contracts";
import { StatusBadge } from "@auction/ui";

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  return (
    <StatusBadge variant={enquiryStatusTone(status)}>{ENQUIRY_STATUS_LABELS[status]}</StatusBadge>
  );
}
