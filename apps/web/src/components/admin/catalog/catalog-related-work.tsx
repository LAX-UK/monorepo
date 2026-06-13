import type { AdminNavCounts } from "@/lib/data/http/admin-nav-counts.types";
import Link from "next/link";

type Props = {
  variant: "lots" | "sales" | "submissions" | "artists" | "conditionReports" | "fulfilment";
  navCounts: AdminNavCounts;
  /** Optional extra link (e.g. drafts missing photos count on attention lens). */
  extra?: { label: string; href: string } | null;
};

/** Compact cross-links from catalog list headers to related queues. */
export function CatalogRelatedWork({ variant, navCounts, extra }: Props) {
  const links: { label: string; href: string }[] = [];

  if (variant === "lots" && navCounts.withdrawalsPending > 0) {
    links.push({
      label: `${navCounts.withdrawalsPending} withdrawal${navCounts.withdrawalsPending === 1 ? "" : "s"} pending`,
      href: "/admin/lots?lens=attention",
    });
  }
  if (variant === "lots" && navCounts.draftLotsMissingPhotos > 0) {
    links.push({
      label: `${navCounts.draftLotsMissingPhotos} draft${navCounts.draftLotsMissingPhotos === 1 ? "" : "s"} missing photos`,
      href: "/admin/lots?lens=attention",
    });
  }
  if (variant === "sales" && navCounts.draftSalesNeedingSetup > 0) {
    links.push({
      label: `${navCounts.draftSalesNeedingSetup} draft sale${navCounts.draftSalesNeedingSetup === 1 ? "" : "s"} need setup`,
      href: "/admin/sales?lens=setup",
    });
  }
  if (variant === "submissions" && navCounts.artistsPending > 0) {
    links.push({
      label: `${navCounts.artistsPending} artist${navCounts.artistsPending === 1 ? "" : "s"} pending review`,
      href: "/admin/artists?status=pending",
    });
  }
  if (variant === "artists" && navCounts.submissionsPending > 0) {
    links.push({
      label: `${navCounts.submissionsPending} submission${navCounts.submissionsPending === 1 ? "" : "s"} pending`,
      href: "/admin/submissions",
    });
  }
  if (variant === "conditionReports" && navCounts.lotFulfilmentPending > 0) {
    links.push({
      label: `${navCounts.lotFulfilmentPending} lot${navCounts.lotFulfilmentPending === 1 ? "" : "s"} in fulfilment`,
      href: "/admin/lot-fulfilment",
    });
  }
  if (variant === "fulfilment" && navCounts.conditionReportsPending > 0) {
    links.push({
      label: `${navCounts.conditionReportsPending} condition report${navCounts.conditionReportsPending === 1 ? "" : "s"} open`,
      href: "/admin/condition-reports",
    });
  }
  if (extra) links.push(extra);

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-sm text-on-surface-variant">
      <span className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
        Related
      </span>
      {links.map((link) => (
        <Link
          key={link.href + link.label}
          href={link.href}
          className="min-h-9 text-link underline-offset-4 hover:underline"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
