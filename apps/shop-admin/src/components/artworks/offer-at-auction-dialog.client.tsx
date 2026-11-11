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
  type BlockerLink,
  type OfferAtAuctionLinks,
  bidLotUrl,
  blockerLink,
} from "@/lib/offer-at-auction-links";
import { compareWithZohoPrice } from "@/lib/zoho-price";
import {
  getAuctionOfferAssessment,
  listAuctionSales,
  offerAtAuction,
} from "@/server/application/admin-inventory-actions.server";
import type { AuctionOfferTarget } from "@/server/application/auction-offer-target";
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
import { ExternalLink } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const FORM_ID = "offer-at-auction";

export type OfferAtAuctionLoaded =
  | { phase: "loading" }
  /** The check or the sale list could not be read; "Try again" loads them again. */
  | { phase: "unavailable"; message: string }
  /** LAX Bid's address and credential are not set on this environment. */
  | { phase: "not_connected" }
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
  /** Where the dialog was opened from; it words the description. */
  source: AuctionOfferTarget["kind"];
  /** What this person can open: the lot in Bid admin, the record in Zoho. */
  links: OfferAtAuctionLinks;
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

const DESCRIPTION: Record<AuctionOfferTarget["kind"], (title: string) => string> = {
  artwork: (title) =>
    `Move ${title} from lax.art to a LAX Bid sale. It starts as a draft lot with the same title, images and details.`,
  register: (title) =>
    `Offer ${title} in a LAX Bid sale. It starts as a draft lot with Zoho's title, images and details.`,
};

/** A reason in words, with the link that goes with it when this person can follow it. */
function BlockerItem({ message, link }: { message: string; link: BlockerLink | null }) {
  return (
    <li>
      {message}
      {link ? (
        <>
          {" "}
          <a
            href={link.href}
            className="font-medium text-staff-fg underline underline-offset-2"
            {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {link.label}
            {link.external ? <span className="sr-only"> (opens in a new tab)</span> : null}
          </a>
        </>
      ) : null}
    </li>
  );
}

/** The dialog as staff see it in every state. It holds no data fetching, so it renders from props. */
export function OfferAtAuctionDialogView({
  open,
  onOpenChange,
  title,
  source,
  links,
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
  const zohoPrice = compareWithZohoPrice(ready?.assessment.zohoPrice ?? null, values.priceText);
  const saleOptions =
    ready?.sales.map((sale) => ({
      value: sale.id,
      label: saleOptionLabel(sale.title, sale.startsAt),
    })) ?? [];
  const doneLotUrl = done ? bidLotUrl(links.bidAdminUrl, done.lotId) : null;
  const closing = loaded.phase === "blocked" || loaded.phase === "not_connected";

  const footer = done ? (
    <>
      {doneLotUrl ? (
        <StaffButton variant="secondary" icon={<ExternalLink aria-hidden />} asChild>
          <a href={doneLotUrl} target="_blank" rel="noopener noreferrer">
            Open lot in LAX Bid
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </StaffButton>
      ) : null}
      <StaffButton variant="primary" onClick={() => onOpenChange(false)}>
        Done
      </StaffButton>
    </>
  ) : (
    <>
      <StaffButton variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
        {closing ? "Close" : "Cancel"}
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
      description={DESCRIPTION[source](title)}
      footer={footer}
    >
      {done ? (
        <Notice
          tone="success"
          title={
            done.created
              ? `Draft lot created in ${done.saleTitle}`
              : `Draft lot ready in ${done.saleTitle}`
          }
        >
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
      ) : loaded.phase === "not_connected" ? (
        <Notice
          tone="info"
          title="LAX Bid isn't connected to LAX Admin yet, so artworks can't be offered at auction from here."
        />
      ) : loaded.phase === "blocked" ? (
        <Notice tone="warning" title="This artwork can't be offered at auction yet">
          <ul className="list-disc pl-5">
            {loaded.assessment.blockers.map((blocker) => (
              <BlockerItem
                key={blocker.message}
                message={blocker.message}
                link={blockerLink(blocker, loaded.assessment, links)}
              />
            ))}
          </ul>
        </Notice>
      ) : ready && ready.sales.length === 0 ? (
        <Notice tone="info" title="No LAX Bid sale is open for new lots">
          Create a sale in LAX Bid first, then come back.
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
          {ready.assessment.laxArtDraft ? (
            <Notice tone="info" title="The lax.art draft stays a draft" />
          ) : null}
          {ready.assessment.draftLot ? (
            <Notice tone="info" title="This artwork already has a draft lot">
              {ready.assessment.draftLot.saleTitle
                ? `It is in ${ready.assessment.draftLot.saleTitle}. Choosing that sale opens the same lot.`
                : "Choosing the same sale opens that lot."}
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
            description={
              zohoPrice.label
                ? `In pounds. Zoho's price is ${zohoPrice.label}. Staff can change the starting price in LAX Bid before the lot is published.`
                : "In pounds. Staff can change it in LAX Bid before the lot is published."
            }
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
          {zohoPrice.differs ? (
            <Notice tone="info" title={`This differs from Zoho's price (${zohoPrice.label})`}>
              The starting price you enter here is the one the lot uses. Zoho's price is not
              changed.
            </Notice>
          ) : null}
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
 * "Offer at auction": makes a draft lot in a LAX Bid sale that has not started, from an original's
 * lax.art page or from its From Zoho record. It checks the original may move (and says why not),
 * lets staff choose the sale and starting price, and needs the consignor's agreement ticked, which
 * is recorded against the person who confirmed it. Staff finish and publish the lot in LAX Bid.
 * If the artwork changed while the dialog was open, the refusal is checked again and the dialog
 * shows the new reason.
 */
export function OfferAtAuctionDialog({
  open,
  onOpenChange,
  target,
  title,
  links,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: AuctionOfferTarget;
  title: string;
  links: OfferAtAuctionLinks;
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
  const targetKey = target.kind === "artwork" ? target.artworkId : target.registerId;

  // biome-ignore lint/correctness/useExhaustiveDependencies: the target is read through its id.
  const load = useCallback(async () => {
    setLoaded({ phase: "loading" });
    const [assessment, sales] = await Promise.all([
      getAuctionOfferAssessment(target).catch(() => null),
      listAuctionSales().catch(() => null),
    ]);
    if (!assessment || !assessment.ok) {
      setLoaded({
        phase: "unavailable",
        message: assessment
          ? adminMutationErrorMessage(assessment)
          : "Could not check this artwork. Try again in a moment.",
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
    if (!sales.data.connected) {
      setLoaded({ phase: "not_connected" });
      return;
    }
    setLoaded({ phase: "ready", assessment: assessment.data, sales: sales.data.sales });
  }, [targetKey]);

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

  /** The artwork may have moved while the dialog was open: if so, show why instead of the form. */
  async function showNewReasonIfBlocked(): Promise<void> {
    const assessment = await getAuctionOfferAssessment(target).catch(() => null);
    if (assessment?.ok && !assessment.data.eligible) {
      setLoaded({ phase: "blocked", assessment: assessment.data });
    }
  }

  async function submit() {
    const body = offerAtAuctionBody(values);
    if (!body) {
      setAttempted(true);
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await offerAtAuction({ target, body, idempotencyKey }).catch(
      () => ({ ok: false, kind: "failed", message: "Offering failed. Try again." }) as const,
    );
    if (!result.ok) {
      setFormError(adminMutationErrorMessage(result));
      await showNewReasonIfBlocked();
      setSaving(false);
      return;
    }
    setSaving(false);
    setDone(result.data);
    toast.success(
      result.data.created
        ? `Draft lot created in ${result.data.saleTitle}`
        : `Draft lot ready in ${result.data.saleTitle}`,
    );
    router.refresh();
  }

  return (
    <OfferAtAuctionDialogView
      open={open}
      onOpenChange={onChange}
      title={title}
      source={target.kind}
      links={links}
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
