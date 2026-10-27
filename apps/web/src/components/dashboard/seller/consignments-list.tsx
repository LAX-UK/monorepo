import type { ConsignmentRow } from "@/app/(client)/selling/consignments/consignments.vm";
import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const KIND_LABELS: Record<ConsignmentRow["kind"], string> = {
  submission: "Submission",
  lot: "Lot",
};

type Props = {
  rows: readonly ConsignmentRow[];
};

/** One card per consignment, whether it is still a submission or already a lot. */
export function ConsignmentsList({ rows }: Props) {
  return (
    <DashboardMobileList className="lg:block">
      {rows.map((row) => (
        <li key={row.key}>
          <DashboardListRowCard
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
                {KIND_LABELS[row.kind]} · {DATE_FORMAT.format(new Date(row.changedAtIso))}
              </p>
            }
            badges={<DotStatusPill label={row.statusLabel} tone={row.statusTone} />}
          />
        </li>
      ))}
    </DashboardMobileList>
  );
}
