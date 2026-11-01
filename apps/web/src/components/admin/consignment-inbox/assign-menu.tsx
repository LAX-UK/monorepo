"use client";

import { listConsignmentAssigneesAction } from "@/lib/actions/consignment-inbox";
import { assignableStaffItems } from "@/lib/admin/consignment-inbox/assign-options";
import { CommandMenu, StaffAvatar } from "@auction/staff-ui";
import type { ConsignmentAssignableStaff } from "@auction/validators";
import { type ReactElement, useEffect, useState } from "react";

type Props = {
  trigger: ReactElement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewerUserId: string;
  /** Who has it now (the tick), and the consignment's specialist. */
  assigneeUserId: string | null;
  specialist: { userId: string; name: string } | null;
  /** Covering moves only this thread; the consignment keeps its specialist. */
  mode: "assign" | "cover";
  onChoose: (person: { userId: string; name: string } | null) => void;
  align?: "start" | "end";
};

/**
 * Assign a thread: colleagues who can reply, each with their role and open threads, searchable.
 * Assigning moves the consignment with it; covering moves only the thread, for a colleague on
 * leave. The list loads when the menu first opens.
 */
export function AssignMenu({
  trigger,
  open,
  onOpenChange,
  viewerUserId,
  assigneeUserId,
  specialist,
  mode,
  onChoose,
  align = "end",
}: Props) {
  const [staff, setStaff] = useState<ConsignmentAssignableStaff[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || staff) return;
    let live = true;
    void listConsignmentAssigneesAction().then((result) => {
      if (!live) return;
      if (result.ok) setStaff(result.data ?? []);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [open, staff]);

  const items = assignableStaffItems(staff ?? [], {
    viewerUserId,
    assigneeUserId,
    exclude: mode === "cover" ? (specialist?.userId ?? null) : null,
  }).map((option) => ({
    id: option.userId,
    label: option.label,
    description: option.description,
    checked: option.current,
    keywords: [option.name],
    leading: <StaffAvatar name={option.name} />,
    onSelect: () => onChoose({ userId: option.userId, name: option.name }),
  }));

  const footer =
    mode === "assign" && assigneeUserId
      ? [{ id: "unassign", label: "Unassign", onSelect: () => onChoose(null) }]
      : mode === "cover" && specialist && assigneeUserId !== specialist.userId
        ? [
            {
              id: "end-cover",
              label: `End cover, back to ${specialist.name}`,
              onSelect: () => onChoose(specialist),
            },
          ]
        : [];

  return (
    <CommandMenu
      trigger={trigger}
      label={mode === "cover" ? "Cover this thread" : "Assign thread"}
      open={open}
      onOpenChange={onOpenChange}
      align={align}
      searchPlaceholder="Find a colleague"
      loading={staff === null && !failed}
      {...(failed ? { error: "Colleagues could not load. Close the menu and try again." } : {})}
      emptyText="No colleague by that name can reply to clients."
      groups={[{ id: "staff", items }]}
      footer={footer}
      note={
        mode === "cover"
          ? `Only this thread moves${specialist ? `; the consignment stays with ${specialist.name}` : ""}.`
          : "The consignment moves with the thread."
      }
    />
  );
}
