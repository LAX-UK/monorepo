import type { OrgWorkRow } from "@/app/(client)/selling/works/org-works.vm";
import { DashboardMobileLotThumbnail } from "@/components/dashboard/list/dashboard-mobile-lot-thumbnail";
import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import Link from "next/link";

type Props = {
  rows: readonly OrgWorkRow[];
};

/** The works an organisation owns. The price shows only on rows the viewer's role may see. */
export function OrgWorksList({ rows }: Props) {
  return (
    <DashboardMobileList className="lg:block">
      {rows.map((row) => (
        <li key={row.lotId}>
          <DashboardListRowCard
            thumbnail={
              <DashboardMobileLotThumbnail href={row.href} src={row.imageUrl} alt={row.title} />
            }
            title={
              <Link
                href={row.href}
                className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline"
              >
                {row.title}
              </Link>
            }
            subtitle={
              <p className="mt-1 font-body text-xs text-on-surface-variant">
                {row.lotNumberLabel} · Won <time dateTime={row.endedAtIso}>{row.endedAtLabel}</time>
              </p>
            }
            {...(row.hammerPriceLabel
              ? {
                  trailing: (
                    <p className="shrink-0 font-body text-sm font-semibold tabular-nums text-on-surface">
                      {row.hammerPriceLabel}
                    </p>
                  ),
                }
              : {})}
          />
        </li>
      ))}
    </DashboardMobileList>
  );
}
