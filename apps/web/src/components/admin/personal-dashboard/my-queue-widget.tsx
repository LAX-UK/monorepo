import { AdminQueueCountBadge } from "@/components/admin/admin-status-badge";
import { CommandPaletteHint } from "@/components/admin/command-palette-hint";
import { AttentionList } from "@/components/dashboard/attention-list";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import type { AdminAttentionRow } from "@/lib/admin/admin-home-types";
import { groupAttentionRows } from "@/lib/admin/group-attention-rows";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  attention: readonly AdminAttentionRow[];
};

export function MyQueueWidget({ attention }: Props) {
  const groups = groupAttentionRows(attention);

  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="space-y-1">
        <h3 className="font-headline text-lg font-semibold text-on-surface">My queue</h3>
        <p className="font-body text-sm text-on-surface-variant">
          Grouped by domain — finance, compliance, people, catalog, and operations work matched to
          sidebar badges.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="space-y-3">
          <DashboardEmptyState
            variant="quiet"
            title="All clear"
            description="Nothing urgent right now. New queue items will appear here when nav badges update."
            headingLevel="h3"
          />
          <CommandPaletteHint />
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const headingId = `my-queue-${group.domain.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <section key={group.domain} className="space-y-2" aria-labelledby={headingId}>
                <div className="flex items-center gap-2">
                  <h4
                    id={headingId}
                    className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
                  >
                    {group.domain}
                  </h4>
                  <AdminQueueCountBadge count={group.items.length} />
                </div>
                <AttentionList items={group.items} />
              </section>
            );
          })}
        </div>
      )}
    </Surface>
  );
}
