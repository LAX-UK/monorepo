import { DELIVERIES_COPY } from "@/lib/admin/deliveries/deliveries-copy";
import { ListPageSkeleton } from "@auction/staff-ui";

const { columns } = DELIVERIES_COPY;

export default function DeliveriesLoading() {
  return (
    <ListPageSkeleton
      title={DELIVERIES_COPY.title}
      description={DELIVERIES_COPY.description}
      columns={[
        columns.lot,
        columns.buyer,
        columns.destination,
        columns.status,
        columns.price,
        columns.waiting,
      ]}
    />
  );
}
