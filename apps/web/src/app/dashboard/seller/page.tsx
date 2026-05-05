import { Button } from "@/components/ui/button";
import { getMySubmissions } from "@/lib/data/http/submissions.server";
import type { ItemSubmissionStatus } from "@auction/types";
import { Card, CardContent } from "@auction/ui/components/card";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { ArrowRight, FileStack, Layers, Sparkles, WalletCards } from "lucide-react";
import Link from "next/link";

function countByStatus(rows: { status: ItemSubmissionStatus }[], status: ItemSubmissionStatus) {
  return rows.filter((r) => r.status === status).length;
}

export default async function SellerOverviewPage() {
  let rows: Awaited<ReturnType<typeof getMySubmissions>> = [];
  let err: string | null = null;
  try {
    rows = await getMySubmissions({ limit: 100, offset: 0 });
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load submissions.";
  }

  const drafts = countByStatus(rows, "draft");
  const inReview =
    countByStatus(rows, "submitted") +
    countByStatus(rows, "under_review") +
    countByStatus(rows, "approved");
  const inSale = countByStatus(rows, "converted");
  const closed = countByStatus(rows, "rejected") + countByStatus(rows, "withdrawn");

  const cards = [
    {
      title: "Drafts",
      value: drafts,
      href: "/dashboard/submissions?status=draft",
      hint: "Finish and submit for review",
    },
    {
      title: "In specialist review",
      value: inReview,
      href: "/dashboard/submissions",
      hint: "Submitted, approved pipeline",
    },
    {
      title: "Live or catalogued",
      value: inSale,
      href: "/dashboard/seller/in-sale",
      hint: "Converted to lots",
    },
    {
      title: "Closed outcomes",
      value: closed,
      href: "/dashboard/submissions",
      hint: "Rejected or withdrawn",
    },
  ];

  return (
    <div className="screen w-full space-y-8">
      <PageHeader
        title="Seller workspace"
        description="Track consignments from first submission through cataloguing, sale, and settlement."
        className="border-0 pb-0"
      />

      {err ? (
        <Card className="border-error/30 bg-error/5">
          <CardContent className="p-6 font-body text-sm text-error">{err}</CardContent>
        </Card>
      ) : null}

      {!err && rows.length === 0 ? (
        <EmptyState
          title="Start your first submission"
          description="Tell our specialists about an artwork or collectible. When approved, we draft the catalogue lot for you."
          action={
            <Button variant="primary" asChild>
              <Link href="/dashboard/submissions/new">
                New submission <ArrowRight className="ml-2 inline size-4" aria-hidden />
              </Link>
            </Button>
          }
        />
      ) : null}

      {!err && rows.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link key={card.title} href={card.href} className="group block min-h-[8rem] rounded-xl">
              <Card className="h-full border-outline-variant/15 bg-surface-container-lowest/80 ring-1 ring-outline-variant/10 transition-colors group-hover:border-primary/40 group-hover:ring-primary/20">
                <CardContent className="flex h-full flex-col justify-between p-5">
                  <div>
                    <p className="font-label text-[10px] font-bold uppercase tracking-[0.25em] text-secondary">
                      {card.title}
                    </p>
                    <p className="mt-3 font-headline text-4xl tabular-nums text-primary">
                      {card.value}
                    </p>
                  </div>
                  <p className="mt-4 font-body text-xs text-on-surface-variant">{card.hint}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="border-outline-variant/15 bg-surface-container-low/40">
          <CardContent className="flex gap-4 p-5">
            <FileStack className="size-10 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-secondary">
                Submissions
              </p>
              <p className="mt-2 font-body text-sm text-on-surface-variant">
                Upload imagery, provenance, and pricing expectations. Specialists reply in the
                review queue.
              </p>
              <Link
                href="/dashboard/submissions"
                className="mt-3 inline-flex font-label text-xs uppercase tracking-widest text-primary underline-offset-4 hover:underline"
              >
                Open submissions
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="border-outline-variant/15 bg-surface-container-low/40">
          <CardContent className="flex gap-4 p-5">
            <Layers className="size-10 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-secondary">
                Items in sale
              </p>
              <p className="mt-2 font-body text-sm text-on-surface-variant">
                Once converted, monitor catalogue status and public links without exposing bidder
                identities.
              </p>
              <Link
                href="/dashboard/seller/in-sale"
                className="mt-3 inline-flex font-label text-xs uppercase tracking-widest text-primary underline-offset-4 hover:underline"
              >
                View items
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="border-outline-variant/15 bg-surface-container-low/40">
          <CardContent className="flex gap-4 p-5">
            <WalletCards className="size-10 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-label text-xs uppercase tracking-widest text-secondary">Payouts</p>
              <p className="mt-2 font-body text-sm text-on-surface-variant">
                Hammer, fees, and adjustments consolidate here as finance operations completes
                wiring.
              </p>
              <Link
                href="/dashboard/seller/payouts"
                className="mt-3 inline-flex font-label text-xs uppercase tracking-widest text-primary underline-offset-4 hover:underline"
              >
                View payouts
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-dashed border-primary/25 bg-primary-container/5">
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <Sparkles className="size-8 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-label text-xs uppercase tracking-widest text-primary">
              Artist profile
            </p>
            <p className="mt-1 font-body text-sm text-on-surface-variant">
              Opt in to manage portrait, biography, and attribution requests routed through admin
              approval.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/dashboard/seller/artist">Edit artist profile</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
