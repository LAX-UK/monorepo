import { AttentionList } from "@/components/dashboard/attention-list";
import type { AdminAttentionRow } from "@/lib/admin/admin-home-types";
import { Surface } from "@auction/ui/components/surface";

type Props = {
  attention: readonly AdminAttentionRow[];
};

export function MyQueueWidget({ attention }: Props) {
  return (
    <Surface variant="section" padding="md" className="space-y-4 border-border-hairline">
      <div className="space-y-1">
        <h3 className="font-headline text-lg font-semibold text-on-surface">My queue</h3>
        <p className="font-body text-sm text-on-surface-variant">
          Finance holds, compliance reviews, onboarding, and catalog work matched to sidebar badges.
        </p>
      </div>
      <AttentionList items={[...attention]} />
    </Surface>
  );
}
