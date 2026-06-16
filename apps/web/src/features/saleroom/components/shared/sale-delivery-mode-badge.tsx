import { getSaleTypePresentation } from "@/lib/sale-type-presentation";
import type { SaleDeliveryMode } from "@auction/types";
import { Badge } from "@auction/ui/components/badge";
import { cn } from "@auction/ui/lib/utils";

type Props = {
  mode: SaleDeliveryMode;
  className?: string;
};

export function SaleDeliveryModeBadge({ mode, className }: Props) {
  const presentation = getSaleTypePresentation(mode);
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-label text-[10px] uppercase tracking-widest",
        presentation.colorClass,
        className,
      )}
    >
      {presentation.label}
    </Badge>
  );
}
