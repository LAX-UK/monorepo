import { cn } from "@auction/ui";

export type MarketingInfoStripProps = {
  dateLabel?: string | null;
  venueLabel?: string | null;
  hoursLabel?: string | null;
  className?: string;
};

export function MarketingInfoStrip({
  dateLabel,
  venueLabel,
  hoursLabel,
  className,
}: MarketingInfoStripProps) {
  const items = [dateLabel, venueLabel, hoursLabel].filter((value): value is string =>
    Boolean(value?.trim()),
  );
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-x-4 gap-y-1 rounded-sm border border-outline-variant bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant",
        className,
      )}
      data-testid="marketing-info-strip"
    >
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}
