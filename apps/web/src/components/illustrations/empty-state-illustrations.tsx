import { cn } from "@auction/ui";
import { LaxIllustration, type LaxIllustrationName } from "@auction/ui/components/lax-illustration";

/**
 * Bid's names for the shared LAX illustration set (packages/ui). The drawings live in one place
 * so Bid, Shop, lax.art, LAX Account and the staff tools show the same moment the same way.
 */
const BID_ILLUSTRATIONS = {
  search: "search",
  queue: "plinth",
  payments: "ledger",
  users: "easel",
  lots: "gavel",
  sales: "gavel",
  press: "frame",
  error: "askew",
  notFound: "ticket",
} as const satisfies Record<string, LaxIllustrationName>;

export type EmptyStateIllustrationKey = keyof typeof BID_ILLUSTRATIONS | LaxIllustrationName;

export function resolveEmptyStateIllustration(
  name: EmptyStateIllustrationKey,
): LaxIllustrationName {
  return name in BID_ILLUSTRATIONS
    ? BID_ILLUSTRATIONS[name as keyof typeof BID_ILLUSTRATIONS]
    : (name as LaxIllustrationName);
}

export function EmptyStateIllustration({
  name,
  className,
  size = "panel",
}: {
  name: EmptyStateIllustrationKey;
  className?: string;
  size?: "page" | "panel" | "compact";
}) {
  return (
    <LaxIllustration
      name={resolveEmptyStateIllustration(name)}
      size={size}
      className={cn("mx-auto", className)}
    />
  );
}
