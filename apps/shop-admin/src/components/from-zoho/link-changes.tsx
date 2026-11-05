import { changeRows, linkFootnote } from "@/server/domain/zoho-link.vm";
import type { AdminZohoLinkComparison } from "@auction/shop-contracts";
import { ChangesTable } from "@auction/staff-ui";

export const BEFORE_HEADING = "lax.art now";
export const AFTER_HEADING = "From Zoho, after linking";

/** The before and after table of one link, in the words every link dialog uses. */
export function LinkChangesTable({
  comparison,
  label = "What linking changes",
}: {
  comparison: readonly AdminZohoLinkComparison[];
  label?: string;
}) {
  return (
    <ChangesTable
      label={label}
      beforeHeading={BEFORE_HEADING}
      afterHeading={AFTER_HEADING}
      rows={changeRows(comparison)}
    />
  );
}

/**
 * What linking one artwork changes: the before and after table, then one line saying how many
 * fields change, that the web address stays, and where the artwork goes in the register.
 */
export function LinkChanges({
  comparison,
  published,
  whereItIs,
}: {
  comparison: readonly AdminZohoLinkComparison[];
  /** Whether the lax.art listing is live; null when this page does not know. */
  published: boolean | null;
  /** Where the register has the artwork now, in words. */
  whereItIs: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <LinkChangesTable comparison={comparison} />
      <p className="text-staff-xs text-staff-muted">
        {linkFootnote({ comparison, published, whereItIs })}
      </p>
    </div>
  );
}
