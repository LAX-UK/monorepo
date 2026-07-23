"use client";

import { type AdminUserPickerRow, UserPicker } from "@/components/admin/user-picker";
import { adminAssignSubmissionResultAction } from "@/lib/actions/admin-submissions";
import {
  resolveAdminUserForPickerAction,
  searchAdminUsersBrowseAction,
} from "@/lib/actions/admin-users-browse";
import { notify } from "@/lib/ui/notify";
import type { ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@auction/ui/components/popover";
import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  submissionId: string;
  status: ItemSubmissionStatus;
  assignedToUserId: string | null | undefined;
};

const ASSIGNABLE_STATUSES: ItemSubmissionStatus[] = ["submitted", "under_review"];

async function searchStaffHits(q: string): Promise<AdminUserPickerRow[]> {
  const result = await searchAdminUsersBrowseAction({
    ...(q.trim() ? { q: q.trim() } : {}),
    role: "staff",
    limit: 10,
    offset: 0,
  });
  if (!result.ok) throw new Error(result.error || "Search failed");
  return (result.data?.rows ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.staffRole ?? row.role,
  }));
}

async function resolveStaffHit(id: string): Promise<AdminUserPickerRow | null> {
  const result = await resolveAdminUserForPickerAction(id);
  if (!result.ok || !result.data) return null;
  return {
    id: result.data.id,
    email: result.data.email,
    name: result.data.name,
    role: result.data.staffRole ?? result.data.role,
  };
}

export function SubmissionReassignPicker({ submissionId, status, assignedToUserId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const currentAssignee = assignedToUserId?.trim() ? assignedToUserId.trim() : null;

  if (!ASSIGNABLE_STATUSES.includes(status)) {
    return null;
  }

  function onAssign(nextAssignee: string | null) {
    startTransition(async () => {
      const result = await adminAssignSubmissionResultAction(submissionId, nextAssignee);
      if (result.ok) {
        notify.success(nextAssignee ? "Assignee updated" : "Assignment cleared");
        setOpen(false);
        router.refresh();
      } else {
        notify.error(result.error);
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-3 font-medium text-secondary"
          disabled={pending}
        >
          <UserPlus className="size-4" aria-hidden />
          Reassign
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-2rem))] p-4" align="end">
        <div className="space-y-3">
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Assign reviewer
          </p>
          <UserPicker
            value={currentAssignee}
            onChange={onAssign}
            disabled={pending}
            searchHits={searchStaffHits}
            resolveHit={resolveStaffHit}
          />
          {currentAssignee ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={pending}
              onClick={() => onAssign(null)}
            >
              Clear assignment
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
