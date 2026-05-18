"use client";

import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import { Button } from "@/components/ui/button";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import type { ItemSubmissionStatus } from "@auction/types";
import { DataTable } from "@auction/ui/components/data-table";
import { EmptyState } from "@auction/ui/components/empty-state";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { Toolbar } from "@auction/ui/components/toolbar";
import { type SubmissionListFilterValues, submissionListFilterSchema } from "@auction/validators";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";

export type SubmissionTableRow = {
  id: string;
  title: string;
  status: ItemSubmissionStatus;
  updatedAt: string;
};

export type SubmissionStatusCounts = Record<ItemSubmissionStatus | "all", number>;

const filterStatusLabel: Record<SubmissionListFilterValues["status"], string> = {
  all: "All statuses",
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  converted: "Converted",
};

const statusTabs: readonly SubmissionListFilterValues["status"][] = [
  "all",
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
  "converted",
];

function statusHref(pathname: string, status: SubmissionListFilterValues["status"], q: string) {
  const next = new URLSearchParams();
  if (status !== "all") next.set("status", status);
  if (q) next.set("q", q);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function tabLabel(
  status: SubmissionListFilterValues["status"],
  counts: SubmissionStatusCounts | undefined,
): string {
  const base = filterStatusLabel[status].replace(" statuses", "");
  if (!counts) return base;
  const n = status === "all" ? counts.all : counts[status];
  return n > 0 ? `${base} · ${n}` : base;
}

function submissionColumns(): ColumnDef<SubmissionTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Item",
      cell: ({ row }) => (
        <Link
          href={`/dashboard/submissions/${row.original.id}`}
          className="font-headline text-sm text-on-surface underline-offset-4 hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <SubmissionStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      accessorFn: (r) => new Date(r.updatedAt).getTime(),
      cell: ({ row }) => (
        <span className="font-body text-xs tabular-nums text-on-surface-variant">
          {new Date(row.original.updatedAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            className="px-4 py-2 text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
            asChild
          >
            <Link href={`/dashboard/submissions/${row.original.id}`}>View</Link>
          </Button>
          {row.original.status === "draft" ? (
            <Button
              variant="primary"
              className="px-4 py-2 text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
              asChild
            >
              <Link href={`/dashboard/submissions/${row.original.id}`}>Edit</Link>
            </Button>
          ) : null}
        </div>
      ),
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: SubmissionTableRow[];
  initialStatus: SubmissionListFilterValues["status"];
  initialQ: string;
  /** Row count from the API for the current status filter (before title `q` filter on the server page). */
  fetchedCount: number;
  statusCounts?: SubmissionStatusCounts;
};

function StartSubmissionAction() {
  return (
    <Button variant="primary" asChild>
      <Link href="/dashboard/submissions/new">Start a submission</Link>
    </Button>
  );
}

export function SubmissionsBoard({
  rows,
  initialStatus,
  initialQ,
  fetchedCount,
  statusCounts,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const columns = useMemo(() => submissionColumns(), []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<SubmissionListFilterValues>({
    resolver: zodResolver(submissionListFilterSchema),
    defaultValues: { status: initialStatus, q: initialQ },
  });

  useEffect(() => {
    form.reset({ status: initialStatus, q: initialQ });
  }, [form, initialStatus, initialQ]);

  const watchedQ = form.watch("q");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const trimmed = watchedQ.trim().slice(0, 200);
      if (trimmed === initialQ) return;
      const next = new URLSearchParams(searchParams.toString());
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [initialQ, pathname, router, searchParams, watchedQ]);

  const clearTitleSearch = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("q");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams]);

  return (
    <div className="space-y-6">
      <SectionTabsNav
        ariaLabel="Submission status"
        className="rounded-xl border border-border-hairline bg-surface-container-lowest px-3"
        items={statusTabs.map((status) => ({
          href: statusHref(pathname, status, initialQ),
          label: tabLabel(status, statusCounts),
          isActive: initialStatus === status,
        }))}
      />

      <Toolbar
        className="flex-col gap-4 rounded-xl border border-border-hairline bg-surface-container-lowest p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-between"
        filters={
          <Form {...form}>
            <form className="flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
              <FormField
                control={form.control}
                name="q"
                render={({ field }) => (
                  <FormItem className="min-w-0 flex-1 space-y-2 lg:max-w-md">
                    <FormLabel
                      htmlFor="submissions-q"
                      className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
                    >
                      Title contains
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        id="submissions-q"
                        placeholder="Filter loaded rows by title…"
                        className="bg-surface-container-low"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        }
      />

      {rows.length === 0 ? (
        fetchedCount > 0 ? (
          <EmptyState
            title="No title matches"
            description="Nothing in the current list matches that title. Try another phrase or clear the title filter."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="secondary" onClick={() => clearTitleSearch()}>
                  Clear title search
                </Button>
                <StartSubmissionAction />
              </div>
            }
          />
        ) : initialStatus !== "all" ? (
          <EmptyState
            title="Nothing in this status"
            description="Try a different status or start a new submission for specialist review."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="secondary" asChild>
                  <Link href="/dashboard/submissions">Show all</Link>
                </Button>
                <StartSubmissionAction />
              </div>
            }
          />
        ) : (
          <EmptyState
            title="No submissions yet"
            description="Start a submission to have our specialists review your item for auction."
            action={<StartSubmissionAction />}
          />
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest shadow-sm">
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No submissions match this filter."
            density="compact"
          />
        </div>
      )}
    </div>
  );
}
