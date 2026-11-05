import { differenceValue } from "@/server/domain/zoho-link.vm";
import type { AdminZohoLinkDifference } from "@auction/shop-contracts";
import { SourceMark } from "@auction/staff-ui";

/**
 * Where lax.art and Zoho disagree. Zoho's value is what the artwork will have, so it leads; the
 * lax.art value it replaces is struck through beside it. Rows that differ are highlighted so they
 * cannot be missed. The web address is never in the list: it is always kept.
 */
export function LinkDifferences({
  differences,
  className,
}: {
  differences: readonly AdminZohoLinkDifference[];
  className?: string;
}) {
  if (differences.length === 0) {
    return (
      <p className={`text-staff-sm text-staff-muted ${className ?? ""}`}>
        lax.art and Zoho already agree. Nothing will change except the link.
      </p>
    );
  }
  return (
    <div className={className}>
      <ul
        aria-label="What Zoho's details will change on lax.art"
        className="divide-y divide-staff-line-subtle overflow-hidden rounded-staff-md border border-staff-warning-line"
      >
        {differences.map((difference) => (
          <li
            key={difference.field}
            data-difference={difference.field}
            className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-0.5 bg-staff-warning-bg px-3 py-2 text-staff-sm"
          >
            <span className="text-staff-muted">{difference.label}</span>
            <span className="min-w-0 break-words">
              <span className="font-medium text-staff-fg">
                {differenceValue(difference.zohoValue)}
              </span>
              <span className="ml-2 text-staff-muted line-through">
                <span className="sr-only">lax.art had </span>
                {differenceValue(difference.laxArtValue)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-staff-xs text-staff-muted">
        <SourceMark source="From Zoho" />
        Zoho's value replaces lax.art's. The web address is kept.
      </p>
    </div>
  );
}
