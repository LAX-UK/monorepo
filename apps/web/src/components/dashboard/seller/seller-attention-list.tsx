import type { SellerAttentionItem } from "@/lib/seller/seller-attention";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

/** Tags read as sentences, so they opt out of the badge's capitals. */
const TAG_CLASS = "normal-case tracking-normal";

type Props = {
  items: readonly SellerAttentionItem[];
};

/**
 * "Needs your attention" as a task list: one whole-row link per task with a status tag, and no
 * numbers to interpret. When there is nothing to do it says so rather than showing an empty box.
 */
export function SellerAttentionList({ items }: Props) {
  return (
    <section aria-labelledby="seller-attention-heading" className="space-y-3 pt-4">
      <h2
        id="seller-attention-heading"
        className="font-headline text-lg font-semibold tracking-tight text-on-surface"
      >
        Needs your attention
      </h2>
      {items.length === 0 ? (
        <Surface variant="section" padding="md">
          <p className="font-body text-sm text-on-surface-variant">
            Nothing needs your attention right now.
          </p>
        </Surface>
      ) : (
        <Surface variant="section" padding="none" className="overflow-hidden">
          <ul className="divide-y divide-border-hairline">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-container-low focus-visible:bg-surface-container-low focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-body text-sm font-semibold text-on-surface group-hover:underline">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block font-body text-xs text-on-surface-variant">
                      {item.detail}
                    </span>
                    {/* On a phone the tag sits under the text so it never squeezes the title. */}
                    <StatusBadge
                      variant="warning"
                      size="sm"
                      className={`${TAG_CLASS} mt-2 sm:hidden`}
                    >
                      {item.status}
                    </StatusBadge>
                  </span>
                  <StatusBadge
                    variant="warning"
                    size="sm"
                    className={`${TAG_CLASS} hidden shrink-0 sm:inline-flex`}
                  >
                    {item.status}
                  </StatusBadge>
                  <ChevronRight className="size-4 shrink-0 text-on-surface-variant" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </section>
  );
}
