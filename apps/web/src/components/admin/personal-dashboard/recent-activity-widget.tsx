import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import type { AdminActivityRow } from "@/lib/admin/admin-home-types";
import { EntityList, Button as UiButton } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  activity: readonly AdminActivityRow[];
};

export function RecentActivityWidget({ activity }: Props) {
  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-headline text-lg font-semibold text-on-surface">Recent activity</h3>
        <Link
          href="/admin/lots"
          className="inline-flex min-h-9 items-center gap-1 font-label text-xs font-semibold uppercase tracking-widest text-primary hover:underline"
        >
          View all
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <EntityList
        responsiveMode="auto"
        empty={{
          title: "No recent lot activity",
          description: "Recently updated lots will appear here once catalogue work starts.",
        }}
        table={
          <div className="hidden overflow-x-auto rounded-md border border-border-hairline md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-hairline bg-surface-container-low/50 font-label text-xs uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3 text-right">Open</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((r) => (
                  <tr key={r.id} className="border-b border-border-hairline">
                    <td className="px-4 py-3 font-medium text-on-surface">{r.title}</td>
                    <td className="px-4 py-3">
                      {r.statusLabel ? (
                        <AdminStatusBadge domain="lot" status={r.statusLabel} size="sm" />
                      ) : (
                        <span className="text-on-surface-variant">{r.meta}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-on-surface">{r.priceLabel ?? "\u2014"}</td>
                    <td className="px-4 py-3 text-right">
                      <UiButton variant="chevron" size="sm" asChild>
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
        }
        cards={
          <ul className="space-y-3">
            {activity.map((r) => (
              <li key={r.id}>
                <Link
                  href={r.href}
                  className="flex min-h-11 flex-col gap-1 rounded-sm border border-border-hairline bg-surface-container-low/30 p-3 transition-colors hover:bg-surface-container-high/50"
                >
                  <span className="font-headline text-sm text-on-surface">{r.title}</span>
                  <span className="text-xs text-on-surface-variant">{r.meta}</span>
                </Link>
              </li>
            ))}
          </ul>
        }
      />
    </Surface>
  );
}
