"use client";

import { adminAuthoriseBuyerAgentAction } from "@/lib/admin/legal-entities/buyer-agent-authorisation.actions";
import {
  type AuthorisationDraft,
  type AuthorisationDraftErrors,
  EMPTY_AUTHORISATION_DRAFT,
  londonToday,
  validateAuthorisationDraft,
} from "@/lib/buyer-agents/authorisation-draft";
import { formatLondonDay } from "@/lib/buyer-agents/authorisation-presenter";
import { notify } from "@/lib/ui/notify";
import {
  DateInput,
  EnumSelect,
  Field,
  MoneyInput,
  Notice,
  SegmentedControl,
  StaffButton,
  StaffDialog,
} from "@auction/staff-ui";
import type { BuyerAgentAuthorisationOverview } from "@auction/types";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  entityName: string;
  buyerAgents: BuyerAgentAuthorisationOverview["buyerAgents"];
  sales: BuyerAgentAuthorisationOverview["sales"];
  /** Preselects the member when opened from their row. */
  initialMemberUserId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SCOPES = [
  { value: "all", label: "All sales" },
  { value: "sale", label: "One sale" },
] as const;

/** Staff authorise one of the organisation's buyer agents to bid for it. */
export function AuthoriseBuyerAgentDialog({
  legalEntityId,
  entityName,
  buyerAgents,
  sales,
  initialMemberUserId,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const initial = (): AuthorisationDraft => ({
    ...EMPTY_AUTHORISATION_DRAFT,
    memberUserId:
      initialMemberUserId ?? (buyerAgents.length === 1 ? (buyerAgents[0]?.userId ?? "") : ""),
  });
  const [draft, setDraft] = useState<AuthorisationDraft>(initial);
  const [limitPence, setLimitPence] = useState<number | null>(null);
  const [errors, setErrors] = useState<AuthorisationDraftErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const today = londonToday();

  const update = (patch: Partial<AuthorisationDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (attempted) setErrors(validateAuthorisationDraft(next, today));
  };

  const close = () => {
    onOpenChange(false);
    setDraft(initial());
    setLimitPence(null);
    setErrors({});
    setAttempted(false);
    setFailure(null);
  };

  const submit = () => {
    const found = validateAuthorisationDraft(draft, today);
    setErrors(found);
    setAttempted(true);
    if (Object.keys(found).length > 0) return;
    setFailure(null);
    startTransition(async () => {
      const result = await adminAuthoriseBuyerAgentAction(legalEntityId, draft);
      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        setFailure(result.error);
        return;
      }
      notify.success(`${result.authorisation.userName} can now bid for ${entityName}`);
      close();
      router.refresh();
    });
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) close();
      }}
      title="Authorise a buyer agent"
      description={`Let a buyer agent bid for ${entityName}. A new authorisation replaces any earlier one for the same sale.`}
      initialFocusRef={cancelRef}
      footer={
        <>
          <StaffButton ref={cancelRef} variant="secondary" disabled={busy} onClick={close}>
            Cancel
          </StaffButton>
          <StaffButton variant="primary" loading={busy} onClick={submit}>
            Authorise
          </StaffButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {failure ? (
          <Notice tone="danger" alert title="That did not go through">
            {failure}
          </Notice>
        ) : null}
        <Field label="Buyer agent" error={errors.memberUserId}>
          <EnumSelect
            value={draft.memberUserId || null}
            onValueChange={(memberUserId) => update({ memberUserId })}
            placeholder="Choose a buyer agent"
            options={buyerAgents.map((agent) => ({
              value: agent.userId,
              label: agent.name,
              description: agent.email,
            }))}
          />
        </Field>
        <SegmentedControl<AuthorisationDraft["scope"]>
          label="Which sales"
          value={draft.scope}
          onValueChange={(scope) => update({ scope, ...(scope === "all" ? { saleId: "" } : {}) })}
          options={SCOPES}
        />
        {draft.scope === "sale" ? (
          <Field
            label="Sale"
            error={errors.saleId}
            {...(sales.length === 0 ? { description: "No sales are open for bidding." } : {})}
          >
            <EnumSelect
              value={draft.saleId || null}
              onValueChange={(saleId) => update({ saleId })}
              placeholder="Choose a sale"
              disabled={sales.length === 0}
              options={sales.map((sale) => ({
                value: sale.id,
                label: sale.title,
                description: `Starts ${formatLondonDay(sale.startTime)}`,
              }))}
            />
          </Field>
        ) : null}
        <Field
          label="Bid limit"
          optional
          description="The highest bid they can place, including auto-bids. Leave empty for no limit."
          error={errors.limit}
        >
          <MoneyInput
            value={limitPence}
            onValueChange={(pence) => {
              setLimitPence(pence);
              update({ limit: pence == null ? "" : (pence / 100).toFixed(2) });
            }}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" optional description="Today if left empty." error={errors.startDay}>
            <DateInput
              value={draft.startDay || null}
              onValueChange={(day) => update({ startDay: day ?? "" })}
              min={today}
            />
          </Field>
          <Field
            label="Ends"
            optional
            description="Runs until revoked if left empty."
            error={errors.endDay}
          >
            <DateInput
              value={draft.endDay || null}
              onValueChange={(day) => update({ endDay: day ?? "" })}
              min={draft.startDay || today}
            />
          </Field>
        </div>
      </form>
    </StaffDialog>
  );
}
