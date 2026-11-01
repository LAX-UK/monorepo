"use client";

import { listSavedRepliesAction } from "@/lib/actions/consignment-inbox";
import { SAVED_REPLIES_PATH } from "@/lib/admin/consignment-inbox/inbox-list-state";
import { type SavedReplyPlaceholder, fillSavedReply } from "@auction/domain";
import { CommandMenu, StaffButton } from "@auction/staff-ui";
import type { SavedReplyView } from "@auction/validators";
import { MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  /** What the thread knows for the placeholders. */
  values: Partial<Record<SavedReplyPlaceholder, string | null>>;
  onInsert: (text: string) => void;
  /** Sales managers and administrators also get a way to the list that manages them. */
  canManage: boolean;
};

const PREVIEW = 90;

/**
 * The team's saved replies, searchable, each inserted into the reply for editing (never sent
 * straight away) with its placeholders filled from the thread.
 */
export function SavedRepliesMenu({ values, onInsert, canManage }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<SavedReplyView[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || replies) return;
    let live = true;
    void listSavedRepliesAction().then((result) => {
      if (!live) return;
      if (result.ok) setReplies(result.data ?? []);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [open, replies]);

  const items = (replies ?? []).map((reply) => {
    const filled = fillSavedReply(reply.body, values);
    const flat = filled.replace(/\s+/g, " ").trim();
    return {
      id: reply.id,
      label: reply.title,
      description: flat.length > PREVIEW ? `${flat.slice(0, PREVIEW - 1)}…` : flat,
      keywords: [reply.body],
      onSelect: () => onInsert(filled),
    };
  });

  return (
    <CommandMenu
      label="Saved replies"
      open={open}
      onOpenChange={setOpen}
      align="start"
      trigger={
        <StaffButton variant="ghost" size="sm" icon={<MessageSquareText aria-hidden />}>
          Saved replies
        </StaffButton>
      }
      searchPlaceholder="Search saved replies"
      loading={replies === null && !failed}
      {...(failed ? { error: "Saved replies could not load. Close the menu and try again." } : {})}
      emptyText={
        replies && replies.length === 0
          ? "The team has no saved replies yet."
          : "No saved reply matches."
      }
      groups={[{ id: "team", heading: "Team replies", items }]}
      footer={
        canManage
          ? [
              {
                id: "manage",
                label: "Manage saved replies",
                onSelect: () => router.push(SAVED_REPLIES_PATH),
              },
            ]
          : []
      }
      note="Inserted for editing. Placeholders fill in."
    />
  );
}
