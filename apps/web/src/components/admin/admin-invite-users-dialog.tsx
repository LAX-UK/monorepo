"use client";

import { AdminInviteForm } from "@/components/admin/admin-invite-form";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@auction/ui/components/dialog";
import { UserPlus } from "lucide-react";
import { useCallback, useId, useState } from "react";

type Props = {
  /** When true, render only the dialog (controlled externally). */
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AdminInviteUsersDialog({
  hideTrigger = false,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: Props) {
  const formId = useId();
  const [openInternal, setOpenInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const open = openProp ?? openInternal;
  const setOpen = onOpenChangeProp ?? setOpenInternal;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && submitting) return;
      setOpen(next);
    },
    [setOpen, submitting],
  );

  const handleCompleteSuccess = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button
            type="button"
            className="min-h-10 rounded-lg bg-secondary px-4 font-label text-sm font-medium hover:bg-secondary/90"
          >
            <UserPlus className="size-4" aria-hidden />
            Invite users
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-[700px]">
        <DialogHeader className="space-y-2 pb-6">
          <DialogTitle className="font-headline text-2xl font-semibold text-on-surface">
            Invite users
          </DialogTitle>
          <DialogDescription className="font-body text-sm text-on-surface-variant">
            Recipients receive a secure signup link by email. Invitations expire after 7 days.
          </DialogDescription>
        </DialogHeader>
        <AdminInviteForm
          formId={formId}
          layout="dialog"
          onSubmittingChange={setSubmitting}
          onCompleteSuccess={handleCompleteSuccess}
        />
        <DialogFooter className="gap-2 border-t border-border-hairline pt-6 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={submitting}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" form={formId} className="min-h-11 gap-2" disabled={submitting}>
            {submitting ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
