import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminLegalEntityPickerRow } from "@/lib/data/http/admin.server";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  entity: AdminLegalEntityPickerRow;
};

/** Browse list row for legal entity lookup hub. */
export function LegalEntityBrowseRow({ entity }: Props) {
  return (
    <Link
      href={`/admin/legal-entities/${entity.id}`}
      className="flex min-h-12 items-center gap-3 rounded-sm border border-border-hairline bg-surface-container-lowest/80 px-4 py-3 transition-colors hover:bg-surface-container-low/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate font-headline text-base text-on-surface">
          {entity.displayName}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-on-surface-variant">
          {entity.id}
        </span>
      </span>
      <AdminStatusBadge domain="legalEntity" status={entity.status} size="sm" />
      <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
    </Link>
  );
}
