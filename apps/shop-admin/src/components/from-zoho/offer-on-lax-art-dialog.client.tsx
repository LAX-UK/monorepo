"use client";

import { ArtistPicker } from "@/components/artworks/artist-picker.client";
import { ArtworkThumbnail } from "@/components/artworks/artwork-thumbnail";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  type OfferOnLaxArtField,
  type OfferOnLaxArtForm,
  type OfferOnLaxArtSaleState,
  SLUG_TAKEN_MESSAGE,
  offerConflictField,
  offerOnLaxArtBody,
  offerOnLaxArtErrorSummary,
  offerOnLaxArtFieldId,
  offerOnLaxArtForm,
  problemsTitle,
  validateOfferOnLaxArtForm,
  withArtist,
} from "@/lib/offer-on-lax-art-form";
import {
  getLaxArtOfferAssessment,
  offerOnLaxArt,
} from "@/server/application/admin-offer-on-lax-art-actions.server";
import { GAP_LABEL } from "@/server/domain/zoho-register.vm";
import type { AdminLaxArtOfferAssessment } from "@auction/shop-contracts";
import {
  ChoiceRow,
  Field,
  FormErrorSummary,
  Notice,
  Skeleton,
  SourceMark,
  StaffButton,
  StaffDialog,
  StaffRadio,
  StaffRadioGroup,
  TextInput,
  toast,
} from "@auction/staff-ui";
import { TriangleAlert } from "@auction/staff-ui/icons";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const FORM_ID = "offer-on-lax-art";
const SOURCE = "From Zoho";

export type OfferOnLaxArtLoaded =
  | { phase: "loading" }
  /** The check could not be read; "Try again" asks again. */
  | { phase: "unavailable"; message: string }
  | { phase: "blocked"; assessment: AdminLaxArtOfferAssessment }
  /** The record already has its draft (made a moment ago, perhaps by someone else). */
  | { phase: "existing"; assessment: AdminLaxArtOfferAssessment }
  | { phase: "ready"; assessment: AdminLaxArtOfferAssessment };

export type OfferOnLaxArtViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  loaded: OfferOnLaxArtLoaded;
  values: OfferOnLaxArtForm;
  onValuesChange: (update: (current: OfferOnLaxArtForm) => OfferOnLaxArtForm) => void;
  errors: Partial<Record<OfferOnLaxArtField, string>>;
  /** Failed submits so far, so the error summary takes focus once per failed submit. */
  failedSubmits: number;
  showErrors: boolean;
  saving: boolean;
  /** Why the last attempt failed; the form keeps what was typed so staff can try again. */
  formError: string | null;
  onSubmit: () => void;
  onRetryLoad: () => void;
  onOpenExisting: (artworkId: string) => void;
};

/** What Zoho decides, shown read-only: the cover, the facts and what is still missing. */
function ZohoFacts({ assessment }: { assessment: AdminLaxArtOfferAssessment }) {
  const missing = assessment.missing.map((gap) => GAP_LABEL[gap].toLowerCase()).join(", ");
  const lacks = (gap: "image" | "size" | "medium") => assessment.missing.includes(gap);
  const facts: Array<{ label: string; text: string; tone: "normal" | "warning" }> = [
    {
      label: "Medium",
      text: lacks("medium") ? "Missing in Zoho" : (assessment.medium ?? ""),
      tone: lacks("medium") ? "warning" : "normal",
    },
    {
      label: "Size",
      text: lacks("size") ? "Missing in Zoho" : (assessment.dimensions ?? ""),
      tone: lacks("size") ? "warning" : "normal",
    },
    {
      label: "Year",
      text: assessment.year === null ? "Not set" : String(assessment.year),
      tone: "normal",
    },
    {
      label: "Images",
      text: lacks("image") ? "None in Zoho" : `${assessment.imageCount}, first is the cover`,
      tone: lacks("image") ? "warning" : "normal",
    },
  ];
  return (
    <>
      <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 rounded-staff-md border border-staff-line bg-staff-sunken p-3">
        <ArtworkThumbnail url={null} className="h-22 w-[72px]" />
        <div className="min-w-0">
          <h3 className="text-staff-md font-semibold text-staff-fg">{assessment.title}</h3>
          <p className="text-staff-xs text-staff-muted">
            {assessment.artistName} ({assessment.artistCode}) ·{" "}
            <span className="tabular-nums">{assessment.stockCode}</span>
          </p>
          <dl className="mt-2 grid grid-cols-[64px_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 text-staff-xs">
            {facts.map((fact) => (
              <div key={fact.label} className="contents">
                <dt className="text-staff-muted">{fact.label}</dt>
                <dd
                  className={`m-0 ${fact.tone === "warning" ? "text-staff-warning-fg" : "text-staff-fg"}`}
                >
                  {fact.text}
                </dd>
              </div>
            ))}
          </dl>
          <SourceMark source={SOURCE} className="mt-2" />
        </div>
      </div>
      {missing ? (
        <p className="-mt-1 flex items-start gap-1.5 text-staff-xs text-staff-warning-fg">
          <TriangleAlert aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span>
            Still missing in Zoho: {missing}. You can make the draft now; it can be published once
            Zoho has it.
          </span>
        </p>
      ) : null}
    </>
  );
}

const SALE_OPTIONS: ReadonlyArray<{
  value: OfferOnLaxArtSaleState;
  label: string;
  description: string;
}> = [
  {
    value: "for_sale",
    label: "Enquiries",
    description: 'Shows "Enquire" on lax.art. Staff agree the price with the buyer.',
  },
  {
    value: "price_on_application",
    label: "Price on application",
    description: 'Shows "Price on application" and takes enquiries.',
  },
];

/** The dialog as staff see it in every state. It holds no data fetching, so it renders from props. */
export function OfferOnLaxArtDialogView({
  open,
  onOpenChange,
  title,
  loaded,
  values,
  onValuesChange,
  errors,
  failedSubmits,
  showErrors,
  saving,
  formError,
  onSubmit,
  onRetryLoad,
  onOpenExisting,
}: OfferOnLaxArtViewProps) {
  const ready = loaded.phase === "ready" ? loaded.assessment : null;
  const summary = showErrors ? offerOnLaxArtErrorSummary(errors) : [];
  const footer =
    loaded.phase === "existing" ? (
      <>
        <StaffButton variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </StaffButton>
        <StaffButton
          variant="primary"
          onClick={() =>
            loaded.assessment.existing && onOpenExisting(loaded.assessment.existing.artworkId)
          }
        >
          Open on lax.art
        </StaffButton>
      </>
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
        {ready ? (
          <StaffButton type="submit" form={FORM_ID} variant="primary" loading={saving}>
            {formError ? "Try again" : "Create lax.art draft"}
          </StaffButton>
        ) : null}
      </>
    );

  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Offer on lax.art"
      description={`Creates a lax.art draft from Zoho's details. Nothing is public until you publish it.`}
      footer={footer}
    >
      {loaded.phase === "loading" ? (
        // biome-ignore lint/a11y/useSemanticElements: a loading placeholder, not a form output
        <div className="flex flex-col gap-3" role="status" aria-label="Checking this artwork">
          <Skeleton className="h-22 w-full" />
          <Skeleton className="h-3.5 w-3/5" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3.5 w-2/5" />
        </div>
      ) : loaded.phase === "unavailable" ? (
        <Notice tone="danger" alert title="Could not check this artwork">
          {loaded.message}
        </Notice>
      ) : loaded.phase === "blocked" ? (
        <div className="flex flex-col gap-3">
          <Notice tone="warning" title="This artwork can't go on lax.art yet">
            <ul className="list-disc pl-5">
              {loaded.assessment.blockers.map((blocker) => (
                <li key={blocker.message}>{blocker.message}</li>
              ))}
            </ul>
          </Notice>
        </div>
      ) : loaded.phase === "existing" ? (
        <Notice tone="info" title="This artwork already has a lax.art draft">
          {title} was put on lax.art a moment ago. Open it to write the description and publish.
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
          <FormErrorSummary
            errors={summary}
            title={problemsTitle(summary.length)}
            focusKey={failedSubmits}
          />
          {formError ? <Notice tone="danger" alert title={formError} /> : null}
          <ZohoFacts assessment={ready} />
          <Field
            label="lax.art artist"
            id={offerOnLaxArtFieldId("artistId")}
            error={showErrors ? errors.artistId : undefined}
            description={
              ready.matchedArtist && values.artistId === ready.matchedArtist.artistId
                ? `Linked to Zoho artist code ${ready.artistCode}`
                : `No lax.art artist has Zoho artist code ${ready.artistCode}. Choose one, and ${ready.artistCode} is saved on that artist for next time.`
            }
          >
            <ArtistPicker
              value={values.artistId}
              selectedName={values.artistName}
              placeholder="Choose a lax.art artist"
              invalid={Boolean(showErrors && errors.artistId)}
              disabled={saving}
              onChange={(artist) => onValuesChange((current) => withArtist(current, artist, title))}
            />
          </Field>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-staff-sm font-medium text-staff-fg">How it is sold</legend>
            <StaffRadioGroup
              aria-label="How it is sold"
              value={values.saleState}
              onValueChange={(saleState) =>
                onValuesChange((current) => ({
                  ...current,
                  saleState: saleState as OfferOnLaxArtSaleState,
                }))
              }
            >
              {SALE_OPTIONS.map((option) => (
                <ChoiceRow
                  key={option.value}
                  htmlFor={`offer-sale-${option.value}`}
                  disabled={saving}
                  control={
                    <StaffRadio
                      id={`offer-sale-${option.value}`}
                      value={option.value}
                      disabled={saving}
                    />
                  }
                  label={option.label}
                  description={option.description}
                />
              ))}
            </StaffRadioGroup>
          </fieldset>
          <Field
            label="Web address"
            id={offerOnLaxArtFieldId("slug")}
            error={showErrors ? errors.slug : undefined}
            description="From the artist and title. It can't change once the artwork is published."
          >
            <TextInput
              value={values.slug}
              leading={<span className="text-staff-muted">lax.art/artworks/</span>}
              autoComplete="off"
              spellCheck={false}
              disabled={saving}
              onChange={(event) =>
                onValuesChange((current) => ({
                  ...current,
                  slug: event.target.value,
                  slugEdited: true,
                }))
              }
            />
          </Field>
          <Notice tone="info" title="Next: the draft opens">
            Write the description and check the images there, then publish.
          </Notice>
        </form>
      ) : null}
    </StaffDialog>
  );
}

/**
 * "Offer on lax.art" for a From Zoho record. It checks the record (and says why not when it
 * cannot go on lax.art), shows Zoho's facts read-only, and asks only what LAX decides: the lax.art
 * artist, how it is sold and the web address. Creating the draft opens it. The same request key is
 * kept across retries, so a retry after a dropped connection returns the draft already made.
 */
export function OfferOnLaxArtDialog({
  open,
  onOpenChange,
  registerId,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registerId: string;
  title: string;
}) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<OfferOnLaxArtLoaded>({ phase: "loading" });
  const [values, setValues] = useState<OfferOnLaxArtForm>(() =>
    offerOnLaxArtForm({ matchedArtist: null, zohoArtistName: "", title }),
  );
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [serverErrors, setServerErrors] = useState<Partial<Record<OfferOnLaxArtField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setLoaded({ phase: "loading" });
    const result = await getLaxArtOfferAssessment(registerId).catch(() => null);
    if (!result || !result.ok) {
      setLoaded({
        phase: "unavailable",
        message: result
          ? adminMutationErrorMessage(result)
          : "Could not check this artwork. Try again in a moment.",
      });
      return;
    }
    const assessment = result.data;
    if (assessment.existing) return setLoaded({ phase: "existing", assessment });
    if (!assessment.eligible) return setLoaded({ phase: "blocked", assessment });
    setValues((current) =>
      current.artistId || current.slugEdited
        ? current
        : offerOnLaxArtForm({
            matchedArtist: assessment.matchedArtist,
            zohoArtistName: assessment.artistName,
            title: assessment.title,
          }),
    );
    setLoaded({ phase: "ready", assessment });
  }, [registerId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the check on "Try again".
  useEffect(() => {
    if (open) void load();
  }, [open, load, attempt]);

  const zohoArtistName = loaded.phase === "ready" ? loaded.assessment.artistName : "this artist";
  const clientErrors = failedSubmits > 0 ? validateOfferOnLaxArtForm(values, zohoArtistName) : {};
  const errors = { ...serverErrors, ...clientErrors };

  function onChange(next: boolean) {
    if (saving) return;
    if (next) {
      setValues(offerOnLaxArtForm({ matchedArtist: null, zohoArtistName: "", title }));
      setFailedSubmits(0);
      setServerErrors({});
      setFormError(null);
      setIdempotencyKey(crypto.randomUUID());
    }
    onOpenChange(next);
  }

  function openDraft(artworkId: string) {
    router.push(`/artworks/${artworkId}?arrived=zoho`);
  }

  async function submit() {
    if (loaded.phase !== "ready") return;
    const found = validateOfferOnLaxArtForm(values, zohoArtistName);
    const body = offerOnLaxArtBody(values);
    if (Object.keys(found).length > 0 || !body) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setSaving(true);
    setFormError(null);
    setServerErrors({});
    const result = await offerOnLaxArt({ registerId, body, idempotencyKey }).catch(
      () =>
        ({
          ok: false,
          kind: "failed",
          message: "The draft could not be created. Your choices are kept. Try again.",
        }) as const,
    );
    if (result.ok) {
      toast.success("lax.art draft created");
      openDraft(result.data.artworkId);
      return;
    }
    setSaving(false);
    const message = adminMutationErrorMessage(result);
    const field = result.kind === "conflict" ? offerConflictField(message) : null;
    if (field) {
      setServerErrors({ [field]: SLUG_TAKEN_MESSAGE });
      setFailedSubmits((count) => count + 1);
      return;
    }
    if (result.kind === "conflict") {
      // Someone moved the artwork while the dialog was open: read it again and say why.
      setIdempotencyKey(crypto.randomUUID());
      void load();
      return;
    }
    setFormError(
      result.kind === "failed"
        ? "The draft could not be created. Your choices are kept. Try again."
        : message,
    );
  }

  return (
    <OfferOnLaxArtDialogView
      open={open}
      onOpenChange={onChange}
      title={title}
      loaded={loaded}
      values={values}
      onValuesChange={(update) => setValues(update)}
      errors={errors}
      failedSubmits={failedSubmits}
      showErrors={failedSubmits > 0}
      saving={saving}
      formError={formError}
      onSubmit={() => void submit()}
      onRetryLoad={() => setAttempt((n) => n + 1)}
      onOpenExisting={openDraft}
    />
  );
}
