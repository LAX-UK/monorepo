"use client";

import { Button } from "@/components/ui/button";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
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
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
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
};

export function SubmissionsBoard({ rows, initialStatus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const columns = useMemo(() => submissionColumns(), []);

  const form = useForm<SubmissionListFilterValues>({
    resolver: zodResolver(submissionListFilterSchema),
    defaultValues: { status: initialStatus },
  });

  useEffect(() => {
    form.reset({ status: initialStatus });
  }, [form, initialStatus]);

  const onApply = (values: SubmissionListFilterValues) => {
    const next = new URLSearchParams(searchParams.toString());
    if (values.status === "all") {
      next.delete("status");
    } else {
      next.set("status", values.status);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form className="flex flex-wrap items-end gap-3" onSubmit={form.handleSubmit(onApply)}>
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
                      ["all", ...itemSubmissionStatuses] as SubmissionListFilterValues["status"][]
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
          <Button type="submit" variant="secondary">
            Apply filter
          </Button>
        </form>
      </Form>

      {rows.length === 0 ? (
        <EmptyState
          title="No submissions yet"
          description="Start a submission to have our specialists review your item for auction."
          action={
            <Button variant="primary" asChild>
              <Link href="/dashboard/submissions/new">Start a submission</Link>
            </Button>
          }
        />
      ) : (
        <DataTable columns={columns} data={rows} emptyMessage="No submissions match this filter." />
      )}
    </div>
  );
}
