import { QUARANTINE_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import { ListPageSkeleton } from "@auction/staff-ui";

export default function EnquiryQuarantineLoading() {
  const { columns } = QUARANTINE_COPY;
  return (
    <ListPageSkeleton
      title={QUARANTINE_COPY.title}
      description={QUARANTINE_COPY.description}
      columns={[columns.from, columns.reason, columns.enquiry, columns.received, columns.deleted]}
    />
  );
}
