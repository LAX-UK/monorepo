import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminActivityRow } from "@/lib/admin/admin-home-types";
import { EntityList, Button as UiButton } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  activity: readonly AdminActivityRow[];
  /** When true, renders without outer card chrome for collapsible context sections. */
  embedded?: boolean;
};

function ActivityTable({ activity }: { activity: readonly AdminActivityRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-shell-stroke font-body text-xs text-on-surface-variant">
          <tr>
            <th className="py-2 pr-4 font-medium">Title</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Price</th>
            <th className="py-2 text-right font-medium">Open</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-shell-stroke">
          {activity.map((r) => (
            <tr key={r.id}>
              <td className="py-3 pr-4 font-medium text-on-surface">{r.title}</td>
              <td className="py-3 pr-4">
                {r.statusLabel ? (
                  <AdminStatusBadge
                    domain="lot"
                    status={r.statusLabel}
                    {...(r.winnerId !== undefined
                      ? { context: { lot: { winnerId: r.winnerId } } }
                      : {})}
                  />
                ) : (
                  <span className="text-on-surface-variant">{r.meta}</span>
                )}
              </td>
              <td className="py-3 pr-4 text-on-surface">{r.priceLabel ?? "\u2014"}</td>
              <td className="py-3 text-right">
                <UiButton variant="ghost" size="sm" asChild>
                  <Link href={r.href} className="inline-flex items-center gap-1">
                    View
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </UiButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecentActivityWidget({ activity, embedded = false }: Props) {
  const content = (
    <EntityList
      responsiveMode="auto"
      empty={{
        title: "No recent lot activity",
        description: "Recently updated lots will appear here once catalogue work starts.",
      }}
      table={<ActivityTable activity={activity} />}
      cards={
        <ul className="divide-y divide-shell-stroke">
          {activity.map((r) => (
            <li key={r.id}>
              <Link
                href={r.href}
                className="flex min-h-11 flex-col gap-1 py-3 transition-colors hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="font-headline text-sm text-on-surface">{r.title}</span>
                <span className="text-xs text-on-surface-variant">{r.meta}</span>
              </Link>
            </li>
          ))}
        </ul>
      }
    />
  );

  if (embedded) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <Link href="/admin/lots" className="font-body text-xs text-link hover:underline">
            View all lots
          </Link>
        </div>
        {content}
      </div>
    );
  }

  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-headline text-lg font-semibold text-on-surface">Recent activity</h3>
        <Link href="/admin/lots" className="font-body text-sm text-link hover:underline">
          View all
        </Link>
      </div>
      {content}
    </Surface>
  );
}
