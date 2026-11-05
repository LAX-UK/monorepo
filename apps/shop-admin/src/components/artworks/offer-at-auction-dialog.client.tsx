"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  type OfferAtAuctionField,
  type OfferAtAuctionForm,
  emptyOfferAtAuctionForm,
  offerAtAuctionBody,
  saleOptionLabel,
  validateOfferAtAuctionForm,
} from "@/lib/offer-at-auction-form";
import {
  getAuctionOfferAssessment,
  listAuctionSales,
  offerAtAuction,
} from "@/server/application/admin-inventory-actions.server";
import type {
  AdminAuctionOfferAssessment,
  AdminAuctionSaleOption,
  AdminOfferAtAuctionResponse,
} from "@auction/shop-contracts";
import {
  ChoiceFieldset,
  ChoiceRow,
  EnumSelect,
  Field,
  Notice,
  Skeleton,
  StaffButton,
  StaffCheckbox,
  StaffDialog,
  TextInput,
  toast,
} from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const FORM_ID = "offer-at-auction";

export type OfferAtAuctionLoaded =
  | { phase: "loading" }
  /** The check or the sale list could not be read; "Try again" loads them again. */
  | { phase: "unavailable"; message: string }
  | { phase: "blocked"; assessment: AdminAuctionOfferAssessment }
  | {
      phase: "ready";
      assessment: AdminAuctionOfferAssessment;
      sales: AdminAuctionSaleOption[];
    };

export type OfferAtAuctionViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  loaded: OfferAtAuctionLoaded;
  values: OfferAtAuctionForm;
  onValuesChange: (update: (current: OfferAtAuctionForm) => OfferAtAuctionForm) => void;
  errors: Partial<Record<OfferAtAuctionField, string>>;
  saving: boolean;
  /** Why the last attempt failed; the form keeps what was typed so staff can try again. */
  formError: string | null;
  /** Set once the draft lot exists. */
  done: AdminOfferAtAuctionResponse | null;
  onSubmit: () => void;
  onRetryLoad: () => void;
};

/** The dialog as staff see it in every state. It holds no data fetching, so it renders from props. */
export function OfferAtAuctionDialogView({
  open,
  onOpenChange,
  title,
  loaded,
  values,
  onValuesChange,
  errors,
  saving,
  formError,
  done,
  onSubmit,
  onRetryLoad,
}: OfferAtAuctionViewProps) {
  const ready = loaded.phase === "ready" ? loaded : null;
  const saleOptions =
    ready?.sales.map((sale) => ({
      value: sale.id,
      label: saleOptionLabel(sale.title, sale.startsAt),
    })) ?? [];

  const footer = done ? (
    <StaffButton variant="primary" onClick={() => onOpenChange(false)}>
      Done
    </StaffButton>
  ) : (
    <>
      <StaffButton variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
        {loaded.phase === "blocked" ? "Close" : "Cancel"}
      </StaffButton>
      {loaded.phase === "unavailable" ? (
        <StaffButton variant="primary" onClick={onRetryLoad}>
          Try again
        </StaffButton>
      ) : null}
      {ready && ready.sales.length > 0 ? (
        <StaffButton type="submit" form={FORM_ID} variant="primary" loading={saving}>
          {formError ? "Try again" : "Offer at auction"}
        </StaffButton>
      ) : null}
    </>
  );

  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Offer at auction"
      description={`Move ${title} from lax.art to a LAX Bid sale. It starts as a draft lot with the same title, images and details.`}
      footer={footer}
    >
      {done ? (
        <Notice tone="success" title={`Draft lot created in ${done.saleTitle}`}>
          {done.withdrawnFromLaxArt
            ? "The artwork is off lax.art. Finish the lot in LAX Bid and publish it there to put it on sale."
            : "Finish the lot in LAX Bid and publish it there to put it on sale."}
        </Notice>
      ) : loaded.phase === "loading" ? (
        // biome-ignore lint/a11y/useSemanticElements: a loading placeholder, not a form output
        <div className="flex flex-col gap-3" role="status" aria-label="Checking this artwork">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/2" />
        </div>
      ) : loaded.phase === "unavailable" ? (
        <Notice tone="danger" alert title="Could not check this artwork">
          {loaded.message}
        </Notice>
      ) : loaded.phase === "blocked" ? (
        <Notice tone="warning" title="This artwork cannot be offered at auction yet">
          <ul className="list-disc pl-5">
            {loaded.assessment.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Notice>
      ) : ready && ready.sales.length === 0 ? (
        <Notice tone="info" title="No LAX Bid sale is open for new lots">
          Create a sale in LAX Bid first, then come back to offer this artwork in it.
        </Notice>
      ) : ready ? (
        <form
          id={FORM_ID}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {formError ? <Notice tone="danger" alert title={formError} /> : null}
          {ready.assessment.onLaxArt ? (
            <Notice tone="info" title="This takes the artwork off lax.art">
              The lax.art listing is withdrawn once the draft lot exists. Publishing the lot in LAX
              Bid puts it on sale there.
            </Notice>
          ) : null}
          <Field label="Sale" error={errors.saleId} id="offer-sale">
            <EnumSelect
              value={values.saleId}
              onValueChange={(saleId) => onValuesChange((current) => ({ ...current, saleId }))}
              options={saleOptions}
              placeholder="Choose a sale"
              disabled={saving}
            />
          </Field>
          <Field
            label="Starting price"
            description="In pounds. Staff can change it in LAX Bid before the lot is published."
            error={errors.price}
            id="offer-price"
          >
            <TextInput
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={values.priceText}
              boxClassName="sm:max-w-60"
              className="tabular-nums"
              disabled={saving}
              onChange={(event) =>
                onValuesChange((current) => ({ ...current, priceText: event.target.value }))
              }
            />
          </Field>
          <ChoiceFieldset legend="Consignor" id="offer-consignor" error={errors.consignorAgreed}>
            <ChoiceRow
              htmlFor="offer-consignor-agreed"
              disabled={saving}
              control={
                <StaffCheckbox
                  id="offer-consignor-agreed"
                  checked={values.consignorAgreed}
                  disabled={saving}
                  onCheckedChange={(checked) =>
                    onValuesChange((current) => ({ ...current, consignorAgreed: checked === true }))
                  }
                />
              }
              label="The consignor agreed to sell at auction"
              description="Your name is recorded with this confirmation."
            />
          </ChoiceFieldset>
        </form>
      ) : null}
    </StaffDialog>
  );
}

/**
 * "Offer at auction": moves an original from lax.art to a LAX Bid sale. It checks the original
 * may move (and says why not), lets staff choose the sale and starting price, and needs the
 * consignor's agreement ticked, which is recorded against the person who confirmed it. The draft
 * lot is made in LAX Bid; staff finish and publish it there.
 */
export function OfferAtAuctionDialog({
  open,
  onOpenChange,
  artworkId,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artworkId: string;
  title: string;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<OfferAtAuctionLoaded>({ phase: "loading" });
  const [values, setValues] = useState<OfferAtAuctionForm>(emptyOfferAtAuctionForm);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [done, setDone] = useState<AdminOfferAtAuctionResponse | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setLoaded({ phase: "loading" });
    const [assessment, sales] = await Promise.all([
      getAuctionOfferAssessment(artworkId).catch(() => null),
      listAuctionSales().catch(() => null),
    ]);
    if (!assessment || !assessment.ok) {
      setLoaded({
        phase: "unavailable",
        message: assessment
          ? adminMutationErrorMessage(assessment)
          : "Could not check this artwork.",
      });
      return;
    }
    if (!assessment.data.eligible) {
      setLoaded({ phase: "blocked", assessment: assessment.data });
      return;
    }
    if (!sales || !sales.ok) {
      setLoaded({
        phase: "unavailable",
        message: sales ? adminMutationErrorMessage(sales) : "Could not load LAX Bid sales.",
      });
      return;
    }
    setLoaded({ phase: "ready", assessment: assessment.data, sales: sales.data.sales });
  }, [artworkId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the check on "Try again".
  useEffect(() => {
    if (open) void load();
  }, [open, load, attempt]);

  function onChange(next: boolean) {
    if (saving) return;
    if (next) {
      setValues(emptyOfferAtAuctionForm());
      setAttempted(false);
      setFormError(null);
      setDone(null);
      setIdempotencyKey(crypto.randomUUID());
    }
    onOpenChange(next);
  }

  async function submit() {
    const body = offerAtAuctionBody(values);
    if (!body) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await offerAtAuction({ artworkId, body, idempotencyKey }).catch(
      () => ({ ok: false, kind: "failed", message: "Offering failed. Try again." }) as const,
    );
    setSaving(false);
    if (!result.ok) {
      setFormError(adminMutationErrorMessage(result));
      return;
    }
    setDone(result.data);
    toast.success(`Draft lot created in ${result.data.saleTitle}`);
    router.refresh();
  }

  return (
    <OfferAtAuctionDialogView
      open={open}
      onOpenChange={onChange}
      title={title}
      loaded={loaded}
      values={values}
      onValuesChange={(update) => setValues(update)}
      errors={attempted ? validateOfferAtAuctionForm(values) : {}}
      saving={saving}
      formError={formError}
      done={done}
      onSubmit={() => void submit()}
      onRetryLoad={() => setAttempt((n) => n + 1)}
    />
  );
}
