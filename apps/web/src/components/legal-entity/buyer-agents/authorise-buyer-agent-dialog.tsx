"use client";

import {
  type AuthorisationDraft,
  type AuthorisationDraftErrors,
  EMPTY_AUTHORISATION_DRAFT,
  londonToday,
  validateAuthorisationDraft,
} from "@/lib/buyer-agents/authorisation-draft";
import { formatDay, formatLondonDay } from "@/lib/buyer-agents/authorisation-presenter";
import { authoriseBuyerAgentAction } from "@/lib/legal-entity/buyer-agent-authorisation.actions";
import { notify } from "@/lib/ui/notify";
import type { AuthorisableBuyerAgent, AuthorisableSale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DatePicker } from "@auction/ui/components/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { RadioCardGroup } from "@auction/ui/components/radio-card-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useRouter } from "next/navigation";
import { type ReactNode, useId, useState, useTransition } from "react";

type Props = {
  legalEntityId: string;
  entityName: string;
  agent: AuthorisableBuyerAgent;
  sales: AuthorisableSale[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function FieldBlock({
  id,
  label,
  hint,
  error,
  onClear,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | undefined;
  /** Shown for optional fields with a value, to empty them again. */
  onClear?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <Label htmlFor={id} className="font-label text-sm font-medium text-on-surface">
          {label}
        </Label>
        {onClear ? (
          <Button
            type="button"
            variant="link"
            size="default"
            className="h-auto px-1 py-0.5 font-body text-xs"
            onClick={onClear}
            aria-label={`Clear ${label.replace(" (optional)", "").toLowerCase()} date`}
          >
            Clear
          </Button>
        ) : null}
      </div>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="font-body text-xs text-on-surface-variant">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="font-body text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, error: string | undefined, hasHint: boolean) {
  return error ? `${id}-error` : hasHint ? `${id}-hint` : undefined;
}

/** An owner or admin lets one buyer agent bid for the organisation. */
export function AuthoriseBuyerAgentDialog({
  legalEntityId,
  entityName,
  agent,
  sales,
  open,
  onOpenChange,
}: Props) {
  const router = useRouter();
  const ids = useId();
  const fieldId = (name: string) => `${ids}-${name}`;
  const blank = (): AuthorisationDraft => ({
    ...EMPTY_AUTHORISATION_DRAFT,
    memberUserId: agent.userId,
  });
  const [draft, setDraft] = useState<AuthorisationDraft>(blank);
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

  const reset = () => {
    setDraft(blank());
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
      const result = await authoriseBuyerAgentAction(legalEntityId, draft);
      if (!result.ok) {
        if (result.fieldErrors) setErrors(result.fieldErrors);
        setFailure(result.error);
        return;
      }
      notify.success(`${agent.name} can now bid for ${entityName}`);
      onOpenChange(false);
      reset();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline text-lg">Authorise {agent.name}</DialogTitle>
          <DialogDescription>
            Let {agent.name} bid for {entityName}. You can change or revoke this at any time.
          </DialogDescription>
        </DialogHeader>
        <form
          id={fieldId("form")}
          className="space-y-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {failure ? (
            <p
              role="alert"
              className="rounded-md border border-error/30 bg-error-container/10 px-3 py-2 font-body text-sm text-on-surface"
            >
              {failure}
            </p>
          ) : null}
          <RadioCardGroup
            legend="Which sales"
            value={draft.scope}
            onValueChange={(scope) =>
              update({
                scope: scope as AuthorisationDraft["scope"],
                ...(scope === "all" ? { saleId: "" } : {}),
              })
            }
            options={[
              { value: "all", label: "All sales", description: "Any sale they can register for" },
              {
                value: "sale",
                label: "One sale",
                description:
                  sales.length > 0 ? "Only the sale you choose" : "No sales are open now",
                disabled: sales.length === 0,
              },
            ]}
          />
          {draft.scope === "sale" ? (
            <FieldBlock id={fieldId("sale")} label="Sale" error={errors.saleId}>
              <Select value={draft.saleId} onValueChange={(saleId) => update({ saleId })}>
                <SelectTrigger
                  id={fieldId("sale")}
                  className="min-h-11"
                  aria-invalid={errors.saleId ? true : undefined}
                  aria-describedby={describedBy(fieldId("sale"), errors.saleId, false)}
                >
                  <SelectValue placeholder="Choose a sale" />
                </SelectTrigger>
                <SelectContent>
                  {sales.map((sale) => (
                    <SelectItem key={sale.id} value={sale.id}>
                      {sale.title} · {formatLondonDay(sale.startTime)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldBlock>
          ) : null}
          <FieldBlock
            id={fieldId("limit")}
            label="Bid limit (optional)"
            hint="The most they can bid on a lot, maximum bids included. Leave empty for no limit."
            error={errors.limit}
          >
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-body text-sm text-on-surface-variant"
              >
                £
              </span>
              <Input
                id={fieldId("limit")}
                inputMode="decimal"
                autoComplete="off"
                placeholder="10,000"
                className="min-h-11 pl-7 tabular-nums"
                value={draft.limit}
                onChange={(event) => update({ limit: event.target.value })}
                aria-invalid={errors.limit ? true : undefined}
                aria-describedby={describedBy(fieldId("limit"), errors.limit, true)}
              />
            </div>
          </FieldBlock>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldBlock
              id={fieldId("start")}
              label="Starts (optional)"
              hint="Today if left empty."
              error={errors.startDay}
              {...(draft.startDay ? { onClear: () => update({ startDay: "" }) } : {})}
            >
              <DatePicker
                id={fieldId("start")}
                value={draft.startDay}
                onChange={(day) => update({ startDay: day })}
                min={today}
                formatValue={formatDay}
                placeholder="Choose a date"
                aria-invalid={errors.startDay ? true : undefined}
                aria-describedby={describedBy(fieldId("start"), errors.startDay, true)}
              />
            </FieldBlock>
            <FieldBlock
              id={fieldId("end")}
              label="Ends (optional)"
              hint="Until you revoke it if left empty."
              error={errors.endDay}
              {...(draft.endDay ? { onClear: () => update({ endDay: "" }) } : {})}
            >
              <DatePicker
                id={fieldId("end")}
                value={draft.endDay}
                onChange={(day) => update({ endDay: day })}
                min={draft.startDay || today}
                formatValue={formatDay}
                placeholder="Choose a date"
                aria-invalid={errors.endDay ? true : undefined}
                aria-describedby={describedBy(fieldId("end"), errors.endDay, true)}
              />
            </FieldBlock>
          </div>
        </form>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form={fieldId("form")}
            className="min-h-11"
            loading={busy}
            loadingLabel="Authorising…"
          >
            Authorise
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
