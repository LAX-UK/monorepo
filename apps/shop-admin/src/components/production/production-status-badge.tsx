import {
  PRODUCTION_STATUS_LABELS,
  productionStatusTone,
} from "@/server/domain/production-queue.vm";
import type { ProductionTaskStatus } from "@auction/shop-contracts";
import { StatusBadge } from "@auction/ui";

export function ProductionStatusBadge({ status }: { status: ProductionTaskStatus }) {
  return (
    <StatusBadge variant={productionStatusTone(status)}>
      {PRODUCTION_STATUS_LABELS[status]}
    </StatusBadge>
  );
}
