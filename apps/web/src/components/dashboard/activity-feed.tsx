import type {
  ActivityItem,
  ActivityKind,
  ActivityTone,
} from "@/lib/data/view-models/dashboard-activity.vm";
import { Button } from "@auction/ui/components/button";
import { Surface } from "@auction/ui/components/surface";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  CreditCard,
  Gavel,
  Mail,
  ShieldCheck,
  Trophy,
  Truck,
  XCircle,
} from "lucide-react";
import Link from "next/link";

type ActivityFeedProps = {
  items: readonly ActivityItem[];
  /** Override the "View all" link. */
  viewAllHref?: string;
  className?: string;
};

const KIND_ICON: Record<ActivityKind, typeof Bell> = {
  outbid: AlertTriangle,
  won: Trophy,
  lost: XCircle,
  "payment-due": CreditCard,
  "payment-received": CreditCard,
  shipping: Truck,
  kyc: ShieldCheck,
  system: Mail,
  info: Gavel,
};

const TONE_RING: Record<ActivityTone, string> = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  positive: "bg-lot-orange/15 text-lot-orange",
  negative: "bg-live-red/15 text-live-red",
  warning: "bg-lot-orange/15 text-lot-orange",
  info: "bg-primary/15 text-primary",
};

function relativeTime(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
}

/** Compact, chronological activity stream for the dashboard overview.
 *
 * Renders nothing when `items` is empty so the overview layout collapses.
 */
export function ActivityFeed({
  items,
  viewAllHref = "/dashboard/notifications",
  className,
}: ActivityFeedProps) {
  if (items.length === 0) return null;
  const now = new Date();

  return (
    <Surface
      variant="section"
      padding="md"
      aria-label="Recent activity"
      className={`space-y-4 border-border-hairline ${className ?? ""}`}
    >
      <div className="flex flex-row items-center justify-between gap-4">
        <div>
          <h2 className="font-headline text-xl font-semibold tracking-tight text-on-surface md:text-2xl">
            Recent activity
          </h2>
          <p className="font-body text-sm text-on-surface-variant">
            Outbid, payments, KYC, and shipping events across your account.
          </p>
        </div>
        <Button variant="chevron" asChild>
          <Link href={viewAllHref} className="inline-flex items-center gap-1 text-xs">
            View all
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div>
        <ul className="divide-y divide-outline-variant/10">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind] ?? Bell;
            const ring = TONE_RING[item.tone] ?? TONE_RING.neutral;
            const Inner = (
              <span className="grid grid-cols-[auto_1fr_auto] items-start gap-3 py-3 sm:px-2">
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full ${ring}`}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-headline text-sm font-semibold text-on-surface">
                    {item.title}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 block truncate text-sm text-on-surface-variant">
                      {item.description}
                    </span>
                  ) : null}
                </span>
                <time
                  dateTime={item.at}
                  suppressHydrationWarning
                  className="shrink-0 font-label text-[10px] uppercase tracking-wider text-on-surface-variant"
                >
                  {relativeTime(item.at, now)}
                </time>
              </span>
            );
            return (
              <li key={item.id}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block rounded-lg transition-colors hover:bg-surface-container-low/45"
                  >
                    {Inner}
                  </Link>
                ) : (
                  <div className="block">{Inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Surface>
  );
}
