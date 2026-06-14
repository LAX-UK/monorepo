import { LotThumbnail } from "@/components/dashboard/overview/lot-thumbnail";
import {
  type SettlementRow,
  formatSettlementTotal,
} from "@/components/dashboard/overview/overview-presenters";
import {
  portfolioSettlementAttentionAction,
  portfolioSettlementLabel,
} from "@/lib/portfolio-settlement";
import { LabelCaps } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type ActionRequiredBannerProps = {
  row: SettlementRow | undefined;
  /** `strip` — thin accent row inside overview hero band. */
  variant?: "card" | "strip";
};

export function ActionRequiredBanner({ row, variant = "card" }: ActionRequiredBannerProps) {
  if (!row) return null;

  const { href, label } = portfolioSettlementAttentionAction(row);

  if (variant === "strip") {
    return (
      <div className="flex flex-col gap-3 border-l-4 border-lot-orange bg-lot-orange/10 py-2 pl-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.22em] text-lot-orange">
            Action required
          </p>
          <p className="truncate font-headline text-sm font-semibold text-on-surface">
            You won {row.lot.title} · {formatSettlementTotal(row)} due
          </p>
        </div>
        <Button size="sm" className="shrink-0" asChild>
          <Link href={href}>{label}</Link>
        </Button>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-lot-orange/25 bg-lot-orange/10 shadow-md">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <LotThumbnail
            src={row.lot.images[0]}
            alt=""
            className="size-16 rounded-xl"
            sizes="64px"
          />
          <div className="min-w-0">
            <LabelCaps className="text-lot-orange">Action required</LabelCaps>
            <h2 className="mt-1 truncate font-headline text-xl font-semibold text-on-surface">
              You won {row.lot.title}
            </h2>
            <p className="text-sm text-on-surface-variant">
              Total due {formatSettlementTotal(row)} · {portfolioSettlementLabel(row)}
            </p>
          </div>
        </div>
        <Button className="min-h-11 shrink-0" asChild>
          <Link href={href}>{label}</Link>
        </Button>
      </div>
    </section>
  );
}
