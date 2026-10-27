"use client";

import { revokeConsequence } from "@/lib/buyer-agents/authorisation-presenter";
import { revokeBuyerAgentAuthorisationAction } from "@/lib/legal-entity/buyer-agent-authorisation.actions";
import { notify } from "@/lib/ui/notify";
import type { BuyerAgentAuthorisationView } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Label } from "@auction/ui/components/label";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { Textarea } from "@auction/ui/components/textarea";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  entityName: string;
  authorisation: BuyerAgentAuthorisationView;
  onClose: () => void;
};

/** Revokes a buyer agent's authorisation, with a short reason kept in the activity log. */
export function RevokeAuthorisationDialog({
  legalEntityId,
  entityName,
  authorisation,
  onClose,
}: Props) {
  const router = useRouter();
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const submit = () => {
    if (reason.trim().length < 3) {
      setError("Give a short reason.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await revokeBuyerAgentAuthorisationAction(
        legalEntityId,
        authorisation.id,
        reason,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      notify.success(`${authorisation.userName} can no longer bid for ${entityName}`);
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-lg">Revoke this authorisation?</DialogTitle>
          <DialogDescription>{revokeConsequence(authorisation, entityName)}</DialogDescription>
        </DialogHeader>
        <form
          id={`${id}-form`}
          className="space-y-1.5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Label
            htmlFor={`${id}-reason`}
            className="font-label text-sm font-medium text-on-surface"
          >
            Reason
          </Label>
          <Textarea
            id={`${id}-reason`}
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              if (error) setError(null);
            }}
            placeholder="For example, no longer buying for us"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : `${id}-hint`}
          />
          {error ? (
            <p id={`${id}-error`} role="alert" className="font-body text-xs text-error">
              {error}
            </p>
          ) : (
            <p id={`${id}-hint`} className="font-body text-xs text-on-surface-variant">
              Kept with the authorisation in your organisation&apos;s activity.
            </p>
          )}
        </form>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={onClose}
          >
            Keep it
          </Button>
          <LoadingButton
            type="submit"
            form={`${id}-form`}
            variant="destructive"
            className="min-h-11"
            loading={busy}
            loadingLabel="Revoking…"
          >
            Revoke authorisation
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
