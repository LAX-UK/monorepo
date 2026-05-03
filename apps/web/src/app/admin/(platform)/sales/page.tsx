import { AdminSalesBoard } from "@/components/admin/admin-sales-board";
import { Button } from "@/components/ui/button";
import { getAdminSalesList } from "@/lib/data/http/admin.server";
import { toAdminSaleBoardRow } from "@/lib/data/view-models/admin-sales.vm";
import type { SaleStatus } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

const statuses: (SaleStatus | "all")[] = [
  "all",
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
];

export default async function AdminSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const statusFilter = sp.status === "all" || !sp.status ? undefined : (sp.status as SaleStatus);

  let rows: Awaited<ReturnType<typeof getAdminSalesList>> = [];
  let err: string | null = null;
  try {
    rows = await getAdminSalesList({
      limit: 100,
      ...(statusFilter ? { status: statusFilter } : {}),
    });
  } catch (e) {
    err = e instanceof Error ? e.message : "Could not load sales.";
  }

  const boardRows = rows.map(toAdminSaleBoardRow);

  const statusChips = (
    <fieldset className="flex min-w-0 flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Filter by status</legend>
      {statuses.map((s) => {
        const qs = new URLSearchParams();
        if (s !== "all") qs.set("status", s);
        const href = qs.toString() ? `/admin/sales?${qs.toString()}` : "/admin/sales";
        const active = (s === "all" && !sp.status) || sp.status === s;
        return (
          <Link
            key={s}
            href={href}
            className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors ${
              active
                ? "bg-primary text-on-primary ring-primary"
                : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
            }`}
          >
            {s}
          </Link>
        );
      })}
    </fieldset>
  );

  return (
    <div className="screen w-full space-y-6">
      <PageHeader
        title="Sales"
        description="Umbrella sessions grouping catalogued lots. Create drafts, attach standalone lots, publish, or cancel from each sale page."
        actions={
          <Button variant="primary" asChild>
            <Link href="/admin/sales/new">
              <Plus className="size-4" aria-hidden />
              New sale
            </Link>
          </Button>
        }
      />

      {err || error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load sales</AlertTitle>
          <AlertDescription>{err ?? error}</AlertDescription>
        </Alert>
      ) : null}

      {!err && rows.length === 0 ? (
        <EmptyState
          title="No sales yet"
          description="Create a sale to group lots for a session or season."
          action={
            <Button variant="primary" asChild>
              <Link href="/admin/sales/new">
                <Plus className="size-4" aria-hidden />
                New sale
              </Link>
            </Button>
          }
        />
      ) : null}

      {!err && boardRows.length > 0 ? (
        <Suspense fallback={<PageSkeleton variant="table" />}>
          <AdminSalesBoard
            rows={boardRows}
            statusChips={statusChips}
            toolbarEnd={
              <Link
                href="/sales"
                className="min-h-11 font-label text-xs uppercase tracking-widest text-secondary underline-offset-4 hover:underline"
              >
                Public sales
              </Link>
            }
          />
        </Suspense>
      ) : null}
    </div>
  );
}
