import { cn } from "@auction/ui";
import { MapPin } from "lucide-react";

type Props = {
  itemsLabel?: string | null;
  locationLabel?: string | null;
  className?: string;
};

/** Items count and/or location (SRP). */
export function SaleCardMeta({ itemsLabel, locationLabel, className }: Props) {
  const hasItems = Boolean(itemsLabel?.trim());
  const hasLocation = Boolean(locationLabel?.trim());
  if (!hasItems && !hasLocation) return null;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {hasItems ? (
        <span className="font-body text-sm font-normal uppercase leading-snug text-on-surface-variant">
          {itemsLabel}
        </span>
      ) : null}
      {hasLocation ? (
        <p className="flex items-center gap-1 font-body text-sm font-normal leading-snug text-on-surface-variant">
          <MapPin className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
          <span>{locationLabel}</span>
        </p>
      ) : null}
    </div>
  );
}
