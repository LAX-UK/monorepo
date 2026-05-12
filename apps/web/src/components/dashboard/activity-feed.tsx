import type {
  ActivityItem,
  ActivityKind,
  ActivityTone,
} from "@/lib/data/view-models/dashboard-activity.vm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@auction/ui/components/card";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
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
    <Card
      aria-label="Recent activity"
      className={`border-outline-variant/15 shadow-lg ${className ?? ""}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="font-headline text-xl font-semibold tracking-tight md:text-2xl">
            Recent activity
          </CardTitle>
          <CardDescription>
            Outbid, payments, KYC, and shipping events across your account.
          </CardDescription>
        </div>
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1 font-label text-xs font-semibold uppercase tracking-widest text-primary hover:underline"
        >
          View all
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
