"use client";

import {
  adminConsignmentMoveOptionsAction,
  adminMoveConsignmentAction,
} from "@/lib/actions/admin-consignment-after-sale";
import {
  CONSIGNMENT_MOVE_AGREEMENT_NOTICE,
  CONSIGNMENT_MOVE_TOLD,
} from "@/lib/admin/submissions/consignment-move-copy";
import { roleLabel } from "@/lib/organisations/legal-entity-labels";
import { notify } from "@/lib/ui/notify";
import {
  ChoiceRow,
  Field,
  Notice,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
} from "@auction/staff-ui";
import type { ConsignmentMoveOptions } from "@auction/types";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";

/** The two calls the dialog makes; injectable so it can be shown and tested on its own. */
export type MoveConsignmentActions = {
  loadOptions: typeof adminConsignmentMoveOptionsAction;
  move: typeof adminMoveConsignmentAction;
};

const SERVER_ACTIONS: MoveConsignmentActions = {
  loadOptions: adminConsignmentMoveOptionsAction,
  move: adminMoveConsignmentAction,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  /** The submission's title, for the question. */
  title: string;
  actions?: MoveConsignmentActions;
};

type Load =
  | { state: "loading" }
  | { state: "failed"; message: string }
  | { state: "ready"; options: ConsignmentMoveOptions };

/**
 * Moves a personal consignment to one of the seller's organisations, on the seller's request.
 * Only organisations the seller could hand the work in for are offered; the dialog says what
 * happens to the consignment agreement and who is told before anything changes.
 */
export function MoveConsignmentDialog({
  open,
  onOpenChange,
  submissionId,
  title,
  actions = SERVER_ACTIONS,
}: Props) {
  const router = useRouter();
  const groupId = useId();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [chosen, setChosen] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoad({ state: "loading" });
    setChosen("");
    setFailure(null);
    void actions.loadOptions(submissionId).then((r) => {
      if (cancelled) return;
      setLoad(
        r.ok && r.data
          ? { state: "ready", options: r.data }
          : { state: "failed", message: r.ok ? "" : r.error },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, submissionId, actions]);

  const options = load.state === "ready" ? load.options : null;
  const target = options?.options.find((o) => o.legalEntityId === chosen) ?? null;
  const nothingToMove = load.state === "failed" || options?.movable === false;
  const agreementNotice = options
    ? CONSIGNMENT_MOVE_AGREEMENT_NOTICE[options.agreementEffect]
    : null;

  const move = () => {
    if (!target) return;
    setFailure(null);
    startTransition(async () => {
      const r = await actions.move(submissionId, target.legalEntityId);
      if (r.ok) {
        notify.success(`Moved to ${target.displayName}. Both sides have been told.`);
        onOpenChange(false);
        router.refresh();
        return;
      }
      setFailure(r.error);
    });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      size="md"
      title={`Move ${title} to an organisation?`}
      description="Do this only when the seller asks. Works in their own name stay personal otherwise."
      footer={
        <>
          <StaffButton variant="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            {nothingToMove ? "Close" : "Cancel"}
          </StaffButton>
          {nothingToMove ? null : (
            <StaffButton variant="primary" loading={pending} disabled={!target} onClick={move}>
              {target ? `Move to ${target.displayName}` : "Move"}
            </StaffButton>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {load.state === "loading" ? (
          <p className="text-staff-sm text-staff-muted" aria-live="polite">
            Finding the seller's organisations…
          </p>
        ) : null}
        {load.state === "failed" ? (
          <Notice tone="danger" alert title="The seller's organisations could not be loaded">
            {load.message}
          </Notice>
        ) : null}
        {options && !options.movable ? (
          <Notice tone="info" title="It cannot be moved">
            {options.reason}
          </Notice>
        ) : null}
        {options?.movable ? (
          <>
            <Field id={groupId} label="Organisation">
              <StaffRadioGroup
                id={groupId}
                value={chosen}
                onValueChange={setChosen}
                aria-label="Organisation"
              >
                {options.options.map((option) => {
                  const id = `${groupId}-${option.legalEntityId}`;
                  return (
                    <ChoiceRow
                      key={option.legalEntityId}
                      htmlFor={id}
                      label={option.displayName}
                      description={`Their role there: ${roleLabel(option.role)}`}
                      control={<StaffRadio id={id} value={option.legalEntityId} />}
                    />
                  );
                })}
              </StaffRadioGroup>
            </Field>
            {agreementNotice ? (
              <Notice tone={agreementNotice.tone} title={agreementNotice.title}>
                {agreementNotice.body}
              </Notice>
            ) : null}
            <p className="text-staff-sm text-staff-muted">{CONSIGNMENT_MOVE_TOLD}</p>
          </>
        ) : null}
        {failure ? (
          <Notice tone="danger" alert title="It was not moved">
            {failure}
          </Notice>
        ) : null}
      </div>
    </StaffDialog>
  );
}
