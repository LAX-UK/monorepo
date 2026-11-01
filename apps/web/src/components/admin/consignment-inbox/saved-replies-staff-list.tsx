"use client";

import { SavedReplyDialog } from "@/components/admin/consignment-inbox/saved-reply-dialog";
import { useStaffConfirm } from "@/components/admin/staff/use-staff-confirm";
import { useStaffListNavigation } from "@/components/admin/staff/use-staff-list-navigation";
import { deleteSavedReplyAction } from "@/lib/actions/consignment-inbox";
import { INBOX_PATH } from "@/lib/admin/consignment-inbox/inbox-list-state";
import { SAVED_REPLY_LIMIT } from "@auction/domain";
import {
  type DataColumn,
  ListPage,
  PrimaryCell,
  StackedCell,
  StaffButton,
  StaffDate,
} from "@auction/staff-ui";
import type { SavedReplyView } from "@auction/validators";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Props = {
  replies: SavedReplyView[];
  loadError: string | null;
  canManage: boolean;
};

/**
 * The team's saved replies: everyone who replies can read them; sales managers and administrators
 * write, edit and retire them. Every change is audited.
 */
export function SavedRepliesStaffList({ replies, loadError, canManage }: Props) {
  const router = useRouter();
  const { Link } = useStaffListNavigation();
  const confirm = useStaffConfirm();
  const [editing, setEditing] = useState<SavedReplyView | null>(null);
  const [creating, setCreating] = useState(false);
  const full = replies.length >= SAVED_REPLY_LIMIT;

  const columns = useMemo<DataColumn<SavedReplyView>[]>(
    () => [
      {
        id: "title",
        header: "Title",
        width: "26%",
        mobile: "title",
        cell: (reply) => <PrimaryCell>{reply.title}</PrimaryCell>,
      },
      {
        id: "body",
        header: "Reply",
        mobile: "meta",
        cell: (reply) => reply.body.replace(/\s+/g, " "),
      },
      {
        id: "updated",
        header: "Updated",
        width: "180px",
        hideBelow: "md",
        mobile: "hidden",
        truncate: false,
        cell: (reply) => (
          <StackedCell secondary={reply.updatedBy?.name ?? null}>
            <StaffDate value={reply.updatedAt} />
          </StackedCell>
        ),
      },
    ],
    [],
  );

  const newButton = canManage ? (
    <StaffButton
      variant="primary"
      icon={<Plus aria-hidden />}
      onClick={() => setCreating(true)}
      {...(full
        ? { disabledReason: `The team keeps up to ${SAVED_REPLY_LIMIT}. Retire one first.` }
        : {})}
    >
      New saved reply
    </StaffButton>
  ) : null;

  return (
    <>
      <ListPage<SavedReplyView>
        title="Saved replies"
        description="Team replies for common client questions, inserted into a reply for editing."
        Link={Link}
        listKey="bid-admin.saved-replies"
        access={canManage ? "full" : "read-only"}
        primaryAction={newButton}
        resultCount={`${replies.length} of ${SAVED_REPLY_LIMIT}`}
        filtered={false}
        error={loadError ? { description: loadError, onRetry: () => router.refresh() } : null}
        empty={{
          title: "No saved replies yet",
          description: canManage
            ? "Write the answers the team gives most often, such as a fixed sale date or an agreement reminder."
            : "Sales managers and administrators write the team's saved replies.",
          ...(newButton ? { action: newButton } : {}),
        }}
        noResults={{ noun: "saved replies" }}
        table={{
          label: "Saved replies",
          columns,
          data: replies,
          getRowId: (reply) => reply.id,
          ...(canManage ? { onRowOpen: (reply: SavedReplyView) => setEditing(reply) } : {}),
          rowActions: {
            label: (reply) => `Actions for ${reply.title}`,
            actions: (reply) => [
              { id: "inbox", label: "Back to the inbox", href: INBOX_PATH },
              ...(canManage
                ? [
                    { id: "edit", label: "Edit", onSelect: () => setEditing(reply) },
                    {
                      id: "delete",
                      label: "Delete",
                      tone: "danger" as const,
                      onSelect: () =>
                        confirm.ask({
                          title: `Delete “${reply.title}”?`,
                          description:
                            "It leaves the menu for everyone. Replies already sent are not changed.",
                          confirmLabel: "Delete",
                          tone: "danger",
                          run: () => deleteSavedReplyAction(reply.id),
                          success: "Saved reply deleted",
                        }),
                    },
                  ]
                : []),
            ],
          },
        }}
      />
      <SavedReplyDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        reply={editing}
      />
      {confirm.dialog}
    </>
  );
}
