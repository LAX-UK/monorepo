"use client";

import { Button } from "@/components/ui/button";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { TableScroll } from "@/components/ui/table-scroll";
import {
  type SubmissionListFilterValues,
  submissionListFilterSchema,
} from "@/lib/forms/submission/submission-form-schema";
import type { ItemSubmissionStatus } from "@auction/types";
import { itemSubmissionStatuses } from "@auction/types";
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
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

export type SubmissionTableRow = {
  id: string;
  title: string;
  status: ItemSubmissionStatus;
  updatedAt: string;
};

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

function submissionColumns(): ColumnDef<SubmissionTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Title",
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
        <span className="font-body text-xs text-on-surface-variant">
          {new Date(row.original.updatedAt).toLocaleString()}
        </span>
      ),
    },
  ];
}

type Props = {
  rows: SubmissionTableRow[];
  initialStatus: SubmissionListFilterValues["status"];
  initialQ: string;
  /** Row count from the API for the current status filter (before title `q` filter on the server page). */
  fetchedCount: number;
};

export function SubmissionsBoard({ rows, initialStatus, initialQ, fetchedCount }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const columns = useMemo(() => submissionColumns(), []);

  const form = useForm<SubmissionListFilterValues>({
    resolver: zodResolver(submissionListFilterSchema),
    defaultValues: { status: initialStatus, q: initialQ },
  });

  useEffect(() => {
    form.reset({ status: initialStatus, q: initialQ });
  }, [form, initialStatus, initialQ]);

  const onApply = (values: SubmissionListFilterValues) => {
    const next = new URLSearchParams(searchParams.toString());
    if (values.status === "all") {
      next.delete("status");
    } else {
      next.set("status", values.status);
    }
    const trimmed = values.q.trim().slice(0, 200);
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const clearTitleSearch = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("q");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router, searchParams]);

  return (
    <div className="space-y-6">
      <Toolbar
        className="flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-stretch sm:justify-between"
        filters={
          <Form {...form}>
            <form
              className="flex w-full min-w-0 flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end"
              onSubmit={form.handleSubmit(onApply)}
            >
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="min-w-[200px] flex-1 space-y-2">
                    <FormLabel className="font-label text-xs uppercase tracking-widest text-secondary">
                      Status
                    </FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="w-full rounded-md border border-outline-variant/20 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
                      >
                        {(
                          [
                            "all",
                            ...itemSubmissionStatuses,
                          ] as SubmissionListFilterValues["status"][]
                        ).map((value) => (
                          <option key={value} value={value}>
                            {filterStatusLabel[value]}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="q"
                render={({ field }) => (
                  <FormItem className="min-w-0 flex-1 space-y-2 lg:max-w-md">
                    <FormLabel
                      htmlFor="submissions-q"
                      className="font-label text-xs uppercase tracking-widest text-secondary"
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
              <Button type="submit" variant="secondary" className="w-full shrink-0 sm:w-auto">
                Apply filters
              </Button>
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
              <Button type="button" variant="secondary" onClick={() => clearTitleSearch()}>
                Clear title search
              </Button>
            }
          />
        ) : initialStatus !== "all" ? (
          <EmptyState
            title="Nothing in this status"
            description="Try a different status or reset to all submissions."
            action={
              <Button type="button" variant="secondary" asChild>
                <Link href="/dashboard/submissions">Show all</Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No submissions yet"
            description="Start a submission to have our specialists review your item for auction."
            action={
              <Button variant="primary" asChild>
                <Link href="/dashboard/submissions/new">Start a submission</Link>
              </Button>
            }
          />
        )
      ) : (
        <TableScroll>
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No submissions match this filter."
          />
        </TableScroll>
      )}
    </div>
  );
}
