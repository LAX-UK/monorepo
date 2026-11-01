import { cn } from "@auction/ui";
import type { CoverSeasonRow } from "./cover-types.js";

/**
 * The season ahead as ruled rows: side by side under a rule on a desktop (up to 900px), and
 * stacked as label-and-value rows between rules on a phone. Shown on the type cover only.
 */
export function CoverSeasons({
  rows,
  className,
}: {
  rows: readonly CoverSeasonRow[];
  className?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <dl
      data-cover-seasons=""
      className={cn(
        "mt-5 flex flex-col md:mt-8 md:w-[900px] md:max-w-[calc(100vw-5rem)] md:flex-row md:border-t md:border-outline-variant",
        className,
      )}
    >
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            "flex min-w-0 justify-between gap-3 border-t border-outline-variant py-[10px]",
            "last:border-b md:block md:border-t-0 md:border-r md:py-0 md:pb-0 md:pr-6 md:pt-3 md:last:border-b-0 md:last:border-r-0",
            "md:mr-6 md:last:mr-0",
          )}
        >
          <dt className="font-body text-[13px] leading-5 text-on-surface-variant">{row.label}</dt>
          <dd className="font-headline text-[15px] font-medium leading-[22px] text-on-surface">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
