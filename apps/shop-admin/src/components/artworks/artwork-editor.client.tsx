"use client";

import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { ArtistPicker } from "@/components/artworks/artist-picker.client";
import { ArtworkMediaField } from "@/components/artworks/artwork-media-field.client";
import {
  ReadOnlyDetails,
  ReadOnlyMedia,
  ReadOnlySearchListing,
} from "@/components/artworks/artwork-read-only-sections";
import { EditionFactsCard } from "@/components/artworks/edition-runs/edition-facts-card.client";
import { EditionRunCard } from "@/components/artworks/edition-runs/edition-run-card.client";
import { LinkedListingsCard } from "@/components/artworks/edition-runs/linked-listings-card.client";
import { OpenStockCard } from "@/components/artworks/edition-runs/open-stock-card.client";
import {
  PrintsConfirmSection,
  PrintsFactsSection,
  PrintsRunSection,
} from "@/components/artworks/edition-runs/prints-create-sections.client";
import { ProofListingDialog } from "@/components/artworks/edition-runs/proof-listing-dialog.client";
import { OriginalArtworkPicker } from "@/components/artworks/original-artwork-picker.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  type ArtworkFormField,
  type ArtworkFormValues,
  artworkConflictField,
  artworkErrorSummary,
  artworkFieldId,
  artworkFormValues,
  buildArtworkCreateBody,
  buildArtworkUpdateBody,
  emptyArtworkForm,
  isArtworkFormDirty,
  validateArtworkForm,
  withArtworkKind,
  withTitle,
} from "@/lib/artwork-form";
import {
  emptyFactsForm,
  factsErrorSummary,
  factsInput,
  factsPreview,
  validateFactsForm,
  withRun,
} from "@/lib/edition-facts-form";
import {
  emptyRunForm,
  firstBatchInput,
  previewSpec,
  proofsKeptInput,
  runErrorSummary,
  runSpecInput,
  validateRunForm,
} from "@/lib/edition-run-form";
import {
  createArtwork,
  getArtworkDetail,
  saveArtwork,
  saveArtworkPrice,
  setArtworkVisibility,
} from "@/server/application/admin-artwork-actions.server";
import { createCompanionListing } from "@/server/application/edition-run-actions.server";
import {
  VISIBILITY_OUTCOME,
  artworkVisibilityActions,
  editionRunFacts,
  publishBlockerMessages,
} from "@/server/domain/artwork-editor.vm";
import {
  CHANNEL_LABELS,
  SALE_STATE_LABELS,
  VISIBILITY_ACTION_LABELS,
  presentArtworkState,
} from "@/server/domain/artwork-list.vm";
import {
  canHaveLinkedListings,
  isOpenSpec,
  mainRunLine,
  proofsAvailable,
} from "@/server/domain/edition-run.vm";
import {
  ADMIN_ARTWORK_CHANNELS,
  ADMIN_ARTWORK_SALE_STATES,
  type AdminArtworkDetail,
  type AdminArtworkVisibilityAction,
  type AdminEditionRunSpec,
  type AdminNewRunInput,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
} from "@auction/shop-contracts";
import {
  ChoiceRow,
  ConfirmActionDialog,
  EnumSelect,
  Field,
  FieldRow,
  FormActions,
  FormErrorSummary,
  FormSection,
  KeyValueList,
  MappedStatusBadge,
  MetaItem,
  MoneyInput,
  Notice,
  OverflowMenu,
  PageHeader,
  SegmentedControl,
  StaffButton,
  StaffRadio,
  StaffRadioGroup,
  StaffReadOnly,
  StatGrid,
  TextArea,
  TextInput,
  UnsavedChangesDialog,
  formatStaffDateTime,
  parsePoundsToPence,
  toast,
  useUnsavedChanges,
} from "@auction/staff-ui";
import { Archive, ArchiveRestore, Eye, EyeOff, Layers, Save, Stamp } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ArtworkEditorPermissions = {
  /** `catalogue.write`: edit, publish, unpublish, archive. */
  write: boolean;
  /** `artwork_price.write`: set or change the edition price. */
  setPrice: boolean;
  /** `edition_facts.correct`: correct a run's facts after a sale (shop admins). */
  correctFacts: boolean;
  /** `hors_commerce.approve`: approve listing hors commerce proofs (shop admins). */
  approveHorsCommerce: boolean;
};

/** For a companion listing: the main run it is another run of. */
export type CompanionOf = {
  artworkId: string;
  title: string;
  spec: AdminEditionRunSpec;
  artistId: string;
  artistName: string;
};

type Conflict = { currentVersion: string };

const ACTION_ICON: Record<AdminArtworkVisibilityAction, typeof Eye> = {
  publish: Eye,
  unpublish: EyeOff,
  archive: Archive,
  restore: ArchiveRestore,
};

function ActionIcon({ action }: { action: AdminArtworkVisibilityAction }) {
  const Icon = ACTION_ICON[action];
  return <Icon aria-hidden />;
}

function counter(value: string, max: number) {
  return `${value.trim().length} of ${max} characters`;
}

/**
 * Create or edit one artwork: details, editions and pricing (pounds on screen, pence stored),
 * media, visibility and search listing, each a form section. Errors show beside their field and
 * in a summary; leaving with unsaved edits asks first; a save shows as done straight away and
 * rolls back if the API refuses it. Visibility actions apply to the saved artwork.
 */
export function ArtworkEditor({
  detail,
  initialArtist = null,
  companionOf = null,
  permissions,
  currentYear,
}: {
  detail: AdminArtworkDetail | null;
  /** For a new artwork started from an artist's page. */
  initialArtist?: { id: string; name: string } | null;
  /** For a new companion listing started from its main run. */
  companionOf?: CompanionOf | null;
  permissions: ArtworkEditorPermissions;
  currentYear: number;
}) {
  const router = useRouter();
  const mode = detail ? "edit" : "create";
  const companion = mode === "create" ? companionOf : null;
  const [record, setRecord] = useState(detail);
  const [values, setValues] = useState<ArtworkFormValues>(() =>
    detail
      ? artworkFormValues(detail)
      : {
          ...emptyArtworkForm(),
          // A companion is by the main run's artist; the API copies the rest from it.
          artistId: companionOf?.artistId ?? initialArtist?.id ?? null,
          artistName: companionOf?.artistName ?? initialArtist?.name ?? null,
        },
  );
  const [baseline, setBaseline] = useState(values);
  const [version, setVersion] = useState(detail?.version ?? null);
  /** Failed submits so far; errors show live once there has been one. */
  const [failedSubmits, setFailedSubmits] = useState(0);
  const [serverErrors, setServerErrors] = useState<Partial<Record<ArtworkFormField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [saving, setSaving] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [confirming, setConfirming] = useState<AdminArtworkVisibilityAction | null>(null);
  const [changingVisibility, setChangingVisibility] = useState(false);
  // New prints: the run, its edition facts and the confirmation, checked with the rest on submit.
  const [runValues, setRunValues] = useState(emptyRunForm);
  const [factsValues, setFactsValues] = useState(emptyFactsForm);
  const [listingProofs, setListingProofs] = useState(false);

  const live = record?.state === "live" || record?.state === "sold_out";
  const context = {
    mode,
    canSetPrice: permissions.setPrice,
    live,
    currentYear,
  } as const;
  const dirty = isArtworkFormDirty(values, baseline);
  const readOnly = !permissions.write;
  /** Finance: the edition price is the only thing they may change. */
  const priceOnly = readOnly && permissions.setPrice && mode === "edit";
  const canSave = permissions.write || priceOnly;
  const guard = useUnsavedChanges(dirty && canSave, {
    navigate: (href) => router.push(href),
    ...(record?.title ? { label: `“${record.title}”` } : {}),
  });
  const attempted = failedSubmits > 0;
  const clientErrors = attempted ? validateArtworkForm(values, context) : {};
  const prints = mode === "create" && values.editionRun === "editions";
  const runContext = {
    linkedToOriginal: companion
      ? companion.spec.type === "custom_limited"
        ? companion.spec.linkedToOriginal
        : false
      : values.sourceOriginalId !== null,
  };
  const chosenSpec = previewSpec(runValues, runContext);
  const runErrors = prints && attempted ? validateRunForm(runValues, runContext) : {};
  const factsErrors = prints && attempted ? validateFactsForm(factsValues, chosenSpec) : {};
  const factsPreviewModel = chosenSpec
    ? factsPreview(factsValues, chosenSpec, proofsKeptInput(runValues))
    : null;

  function updateFacts(patch: Partial<typeof factsValues>) {
    setFactsValues((current) => withRun({ ...current, ...patch }, chosenSpec));
  }

  /** The run of new prints as the API takes it, or null while the run or its facts need fixing. */
  function newRunInput(): AdminNewRunInput | null {
    if (Object.keys(validateRunForm(runValues, runContext)).length > 0) return null;
    const facts = factsInput(factsValues);
    if (!facts || Object.keys(validateFactsForm(factsValues, chosenSpec)).length > 0) return null;
    const firstBatch = firstBatchInput(runValues);
    return {
      spec: runSpecInput(runValues),
      proofsKept: proofsKeptInput(runValues),
      facts,
      factsConfirmed: factsValues.confirmed,
      ...(firstBatch ? { firstBatch } : {}),
    };
  }
  const errors = { ...serverErrors, ...clientErrors };
  // In page order: the run and its facts come first for new prints.
  const summary = [
    ...runErrorSummary(runErrors),
    ...factsErrorSummary(factsErrors),
    ...artworkErrorSummary(errors),
  ];

  function update(patch: Partial<ArtworkFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  }

  async function submit(expectedVersion = version) {
    const found = validateArtworkForm(values, context);
    const run = prints ? newRunInput() : null;
    if (Object.keys(found).length > 0 || (prints && !run)) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setFormError(null);
    setSaving(true);
    if (mode === "create" && companion && run) {
      const body = buildArtworkCreateBody(values, context, run);
      const result = await createCompanionListing({
        artworkId: companion.artworkId,
        body: {
          slug: body.slug,
          title: body.title,
          run,
          ...(body.printPricePence ? { printPricePence: body.printPricePence } : {}),
        },
        idempotencyKey,
      }).catch(() => ({ ok: false, kind: "failed", message: "Save failed. Try again." }) as const);
      setSaving(false);
      if (!result.ok) {
        const field = result.kind === "conflict" ? artworkConflictField(result.message) : null;
        if (result.kind === "conflict" && field) {
          setServerErrors({ [field]: result.message });
          setFailedSubmits((count) => count + 1);
        } else setFormError(adminMutationErrorMessage(result));
        toast.error("The companion listing was not created");
        return;
      }
      setBaseline(values);
      toast.success(`Created “${values.title.trim()}” as a draft`);
      await guard.release();
      router.replace(`/artworks/${result.data.artworkId}`);
      return;
    }
    if (mode === "create") {
      const result = await createArtwork({
        body: buildArtworkCreateBody(values, context, run),
        idempotencyKey,
      }).catch(() => ({ ok: false, kind: "failed", message: "Save failed. Try again." }) as const);
      setSaving(false);
      if (!result.ok) {
        const field = result.kind === "conflict" ? artworkConflictField(result.message) : null;
        if (result.kind === "conflict" && field) {
          setServerErrors({ [field]: result.message });
          setFailedSubmits((count) => count + 1);
        } else setFormError(adminMutationErrorMessage(result));
        toast.error("The artwork was not created");
        return;
      }
      setBaseline(values);
      toast.success(`Created “${values.title.trim()}” as a draft`);
      await guard.release();
      router.replace(`/artworks/${result.data.artworkId}`);
      return;
    }

    if (!record || !expectedVersion) return;
    // Optimistic: the form reads as saved at once; a refusal puts the edits back as unsaved.
    const previous = baseline;
    setBaseline(values);
    const body = buildArtworkUpdateBody(values, context, record.printPricePence);
    const save = priceOnly
      ? saveArtworkPrice({
          artworkId: record.artworkId,
          printPricePence: body.printPricePence ?? null,
          expectedVersion,
          idempotencyKey,
        })
      : saveArtwork({ artworkId: record.artworkId, body, expectedVersion, idempotencyKey });
    const result = await save.catch(
      () => ({ ok: false, kind: "failed", message: "Save failed. Try again." }) as const,
    );
    setSaving(false);
    if (!result.ok) {
      setBaseline(previous);
      if (result.kind === "conflict" && result.currentVersion) {
        setConflict({ currentVersion: result.currentVersion });
      } else {
        setFormError(adminMutationErrorMessage(result));
      }
      toast.error("Your changes were not saved");
      return;
    }
    setVersion(result.data.version);
    setConflict(null);
    setIdempotencyKey(crypto.randomUUID());
    setFailedSubmits(0);
    toast.success("Changes saved");
    router.refresh();
  }

  async function reloadTheirs() {
    if (!record) return;
    const result = await getArtworkDetail(record.artworkId);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    const next = artworkFormValues(result.data);
    setRecord(result.data);
    setValues(next);
    setBaseline(next);
    setVersion(result.data.version);
    setConflict(null);
    setFailedSubmits(0);
    setIdempotencyKey(crypto.randomUUID());
  }

  async function changeVisibility(action: AdminArtworkVisibilityAction) {
    if (!record) return;
    setChangingVisibility(true);
    const result = await setArtworkVisibility({
      artworkId: record.artworkId,
      action,
      idempotencyKey: crypto.randomUUID(),
    }).catch(() => ({ ok: false, kind: "failed", message: "Action failed. Try again." }) as const);
    setChangingVisibility(false);
    setConfirming(null);
    if (!result.ok) {
      toast.error(adminMutationErrorMessage(result));
      return;
    }
    setRecord({ ...record, state: result.data.state });
    setVersion(result.data.version);
    toast.success(`${VISIBILITY_ACTION_LABELS[action].past} “${record.title}”`);
    router.refresh();
  }

  const visibility = record ? artworkVisibilityActions(record) : null;
  // The money field resets its text whenever `value` differs from what it last parsed, so it is
  // fed its own reading of the text; the form's stricter rules apply on validation.
  const typedPence = parsePoundsToPence(values.priceText);
  const title =
    mode === "create"
      ? values.title.trim() || (companion ? "New companion listing" : "New artwork")
      : record?.title;
  const run = record?.run ?? null;
  const linkedActions =
    run && canHaveLinkedListings(run.spec) && permissions.write
      ? [
          {
            id: "create-proof-listing",
            label: "Create proof listing",
            icon: Stamp,
            disabled: dirty,
            onSelect: () => setListingProofs(true),
          },
          {
            id: "create-companion-listing",
            label: "Create companion listing",
            icon: Layers,
            disabled: dirty,
            onSelect: () => record && router.push(`/artworks/new?companionOf=${record.artworkId}`),
          },
        ]
      : [];

  const visibilityButton = (
    action: AdminArtworkVisibilityAction,
    variant: "primary" | "secondary",
  ) => {
    return (
      <StaffButton
        variant={variant}
        icon={<ActionIcon action={action} />}
        disabled={readOnly || dirty || changingVisibility}
        loading={changingVisibility && confirming === action}
        onClick={() => setConfirming(action)}
      >
        {VISIBILITY_ACTION_LABELS[action].verb}
      </StaffButton>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={
          <AdminBreadcrumbs list={{ label: "Artworks", href: "/artworks" }} current={title ?? ""} />
        }
        title={title}
        status={
          record ? <MappedStatusBadge status={record.state} present={presentArtworkState} /> : null
        }
        meta={
          record ? (
            <>
              <MetaItem label="Artist">{record.artist.displayName}</MetaItem>
              <MetaItem label="Updated">{formatStaffDateTime(record.updatedAt)}</MetaItem>
            </>
          ) : undefined
        }
        overflow={
          record &&
          visibility &&
          (visibility.more.length > 0 || linkedActions.length > 0) &&
          !readOnly ? (
            <OverflowMenu
              actions={[
                ...linkedActions,
                ...visibility.more.map((action) => ({
                  id: action,
                  label: VISIBILITY_ACTION_LABELS[action].verb,
                  icon: ACTION_ICON[action],
                  tone: action === "archive" ? ("danger" as const) : ("default" as const),
                  disabled: dirty,
                  onSelect: () => setConfirming(action),
                })),
              ]}
            />
          ) : undefined
        }
        secondaryActions={
          visibility?.primary && !readOnly
            ? visibilityButton(visibility.primary, "secondary")
            : undefined
        }
        primaryAction={
          !canSave ? undefined : (
            <StaffButton
              type="submit"
              form="artwork-form"
              variant="primary"
              icon={<Save aria-hidden />}
              loading={saving}
              disabled={mode === "edit" && !dirty}
            >
              {mode === "create" ? "Create draft" : dirty ? "Save changes" : "Saved"}
            </StaffButton>
          )
        }
      />

      {conflict ? (
        <Notice
          tone="warning"
          alert
          title="Someone else saved this artwork after you opened it"
          actions={
            <>
              <StaffButton size="sm" variant="secondary" onClick={() => void reloadTheirs()}>
                Load their version
              </StaffButton>
              <StaffButton
                size="sm"
                variant="primary"
                onClick={() => void submit(conflict.currentVersion)}
              >
                Save mine over it
              </StaffButton>
            </>
          }
        >
          Loading theirs discards your edits. Saving yours replaces their changes.
        </Notice>
      ) : null}
      {formError ? <Notice tone="danger" alert title={formError} /> : null}
      {priceOnly ? (
        <Notice title="You can change the edition price">
          The other details are edited by staff who manage the catalogue.
        </Notice>
      ) : null}
      {dirty && mode === "edit" && visibility?.primary ? (
        <p className="sr-only" aria-live="polite">
          Save your changes before you{" "}
          {VISIBILITY_ACTION_LABELS[visibility.primary].verb.toLowerCase()}.
        </p>
      ) : null}

      <form
        id="artwork-form"
        noValidate
        aria-label={mode === "create" ? "New artwork" : `Edit ${record?.title ?? "artwork"}`}
        className="flex flex-col gap-6 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <FormErrorSummary errors={attempted ? summary : []} focusKey={failedSubmits} />

        {mode === "create" && !companion ? (
          <FormSection
            title="What are you adding?"
            description="Prints sell on LAX Shop; an original is shown on lax.art and sold by enquiry."
          >
            <StaffRadioGroup
              aria-label="What are you adding?"
              value={values.editionRun}
              onValueChange={(kind) =>
                update(withArtworkKind(values, kind === "original" ? "original" : "editions"))
              }
            >
              <ChoiceRow
                htmlFor="artwork-kind-prints"
                control={<StaffRadio id="artwork-kind-prints" value="editions" />}
                label="Prints"
                description="A run of prints of one image: LAX standard, a custom limited edition or an open edition."
              />
              <ChoiceRow
                htmlFor="artwork-kind-original"
                control={<StaffRadio id="artwork-kind-original" value="original" />}
                label="Original"
                description="A unique work on lax.art, sold by enquiry. It has no edition price."
              />
            </StaffRadioGroup>
          </FormSection>
        ) : null}
        {companion ? (
          <Notice title={`Main run: ${mainRunLine(companion)}`}>
            The artist, details and images are copied from it. Choose this listing's own run and
            edition facts, such as an unsigned open edition beside a signed one.
          </Notice>
        ) : null}

        {prints ? (
          <>
            <PrintsRunSection
              values={runValues}
              errors={runErrors}
              linkedToOriginal={runContext.linkedToOriginal}
              onChange={(patch) => setRunValues((current) => ({ ...current, ...patch }))}
              original={
                companion ? null : (
                  <Field
                    label="Original on lax.art"
                    optional={!runErrors.original}
                    description="The original these prints were made from. Buyer prints go to its buyer."
                    error={runErrors.original}
                    id="run-original"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-full sm:max-w-80">
                        <OriginalArtworkPicker
                          value={values.sourceOriginalId}
                          selectedTitle={values.sourceOriginalTitle}
                          onChange={(original) =>
                            update({
                              sourceOriginalId: original?.id ?? null,
                              sourceOriginalTitle: original?.label ?? null,
                            })
                          }
                        />
                      </div>
                      {values.sourceOriginalId ? (
                        <StaffButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            update({ sourceOriginalId: null, sourceOriginalTitle: null })
                          }
                        >
                          Remove link
                        </StaffButton>
                      ) : null}
                    </div>
                  </Field>
                )
              }
            />
            <PrintsFactsSection
              values={factsValues}
              errors={factsErrors}
              spec={chosenSpec}
              preview={factsPreviewModel}
              onChange={updateFacts}
            />
          </>
        ) : null}

        {readOnly && record ? (
          <ReadOnlyDetails values={values} record={record} />
        ) : (
          <FormSection
            title="Details"
            description="What the work is and who made it, as shown on its storefront page."
          >
            <Field
              label="Title"
              error={errors.title}
              id={artworkFieldId("title")}
              disabled={readOnly}
            >
              <TextInput
                value={values.title}
                autoComplete="off"
                onChange={(event) => update(withTitle(values, event.target.value))}
              />
            </Field>
            {mode === "create" ? (
              <Field
                label="Web address"
                description="Lower case words joined by hyphens. Fixed once the artwork is created."
                error={errors.slug}
                id={artworkFieldId("slug")}
              >
                <TextInput
                  value={values.slug}
                  leading={<span className="text-staff-muted">/artworks/</span>}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => update({ slug: event.target.value, slugEdited: true })}
                />
              </Field>
            ) : (
              <KeyValueList
                items={[
                  {
                    label: "Web address",
                    value: `/artworks/${record?.slug ?? ""}`,
                    ...(record ? { copyValue: record.slug } : {}),
                  },
                ]}
              />
            )}
            {companion ? null : (
              <>
                <Field
                  label="Artist"
                  error={errors.artistId}
                  id={artworkFieldId("artistId")}
                  disabled={readOnly}
                >
                  <ArtistPicker
                    value={values.artistId}
                    selectedName={values.artistName}
                    onChange={(artist) =>
                      update({ artistId: artist?.id ?? null, artistName: artist?.label ?? null })
                    }
                  />
                </Field>
                <FieldRow>
                  <Field
                    label="Year"
                    optional
                    error={errors.yearCreated}
                    id={artworkFieldId("yearCreated")}
                    disabled={readOnly}
                  >
                    <TextInput
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder={String(currentYear)}
                      value={values.yearCreated}
                      onChange={(event) => update({ yearCreated: event.target.value })}
                    />
                  </Field>
                  <Field
                    label="Medium"
                    optional
                    error={errors.medium}
                    id={artworkFieldId("medium")}
                    disabled={readOnly}
                  >
                    <TextInput
                      placeholder="Oil on linen"
                      value={values.medium}
                      onChange={(event) => update({ medium: event.target.value })}
                    />
                  </Field>
                </FieldRow>
                <Field
                  label="Dimensions"
                  optional
                  description="As it should read, such as 60 × 80 cm."
                  error={errors.dimensions}
                  id={artworkFieldId("dimensions")}
                  disabled={readOnly}
                >
                  <TextInput
                    value={values.dimensions}
                    onChange={(event) => update({ dimensions: event.target.value })}
                  />
                </Field>
                <Field
                  label="Description"
                  optional
                  error={errors.description}
                  id={artworkFieldId("description")}
                  disabled={readOnly}
                >
                  <TextArea
                    rows={6}
                    value={values.description}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                </Field>
              </>
            )}
          </FormSection>
        )}

        <FormSection
          title={prints ? "Price" : "Editions and pricing"}
          description={
            prints
              ? "Every print in the run sells at one price."
              : "Editions are sold at one price each. Counts here are for staff only; the storefront shows only whether editions are available."
          }
        >
          {mode === "create" ? null : record?.run ? (
            record.run.stock ? null : (
              <StatGrid label="Edition counts" items={editionRunFacts(record.editions)} />
            )
          ) : (
            <KeyValueList
              items={[{ label: "Edition run", value: "Original only, sold by enquiry" }]}
            />
          )}

          {values.editionRun === "editions" ? (
            <StaffReadOnly readOnly={!permissions.setPrice}>
              <Field
                label="Price per edition"
                optional={!(live && values.saleState === "for_sale")}
                description={
                  permissions.setPrice
                    ? "In pounds, including VAT. Leave blank until the price is agreed."
                    : "Only a shop admin can set or change the price."
                }
                error={errors.price}
                id={artworkFieldId("price")}
              >
                <MoneyInput
                  value={typedPence.ok ? typedPence.pence : null}
                  onValueChange={() => undefined}
                  onInput={(event) => update({ priceText: event.currentTarget.value })}
                  placeholder="0.00"
                  boxClassName="sm:max-w-60"
                />
              </Field>
            </StaffReadOnly>
          ) : null}

          {values.editionRun === "editions" && mode === "edit" ? (
            readOnly ? (
              <KeyValueList
                items={[
                  {
                    label: "Original on lax.art",
                    value: values.sourceOriginalTitle ?? "None linked",
                  },
                ]}
              />
            ) : (
              <Field
                label="Original on lax.art"
                optional
                description="The original this edition was made from. Once both are live, the edition's page links to the original and the original's page lists this edition."
                id="artwork-source-original"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="w-full sm:max-w-80">
                    <OriginalArtworkPicker
                      value={values.sourceOriginalId}
                      selectedTitle={values.sourceOriginalTitle}
                      onChange={(original) =>
                        update({
                          sourceOriginalId: original?.id ?? null,
                          sourceOriginalTitle: original?.label ?? null,
                        })
                      }
                    />
                  </div>
                  {values.sourceOriginalId ? (
                    <StaffButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => update({ sourceOriginalId: null, sourceOriginalTitle: null })}
                    >
                      Remove link
                    </StaffButton>
                  ) : null}
                </div>
              </Field>
            )
          ) : null}

          {companion ? null : readOnly ? (
            <KeyValueList items={[{ label: "Sale", value: SALE_STATE_LABELS[values.saleState] }]} />
          ) : (
            <Field label="Sale" id="artwork-sale-state" disabled={readOnly}>
              <EnumSelect
                value={values.saleState}
                onValueChange={(saleState) => update({ saleState })}
                options={ADMIN_ARTWORK_SALE_STATES.map((value) => ({
                  value,
                  label: SALE_STATE_LABELS[value],
                  ...(value === "price_on_application"
                    ? { description: "Shows “Price on application” and takes enquiries" }
                    : value === "sold"
                      ? { description: "The original has sold" }
                      : {
                          description:
                            "Buyable at the edition price, or by enquiry for an original",
                        }),
                }))}
                className="sm:max-w-80"
              />
            </Field>
          )}
        </FormSection>

        {companion ? null : readOnly && record ? (
          <ReadOnlyMedia images={values.images} importedImageUrl={record.importedImageUrl} />
        ) : (
          <FormSection
            title="Media"
            description="The first image is the primary one: it leads the gallery and is the thumbnail in lists."
          >
            <ArtworkMediaField
              id={artworkFieldId("images")}
              images={values.images}
              importedImageUrl={record?.importedImageUrl ?? null}
              disabled={readOnly}
              error={errors.images}
              onChange={(images) => update({ images })}
            />
          </FormSection>
        )}

        {companion ? null : (
          <FormSection
            title="Visibility"
            description="Where the artwork is sold, and whether it is on the storefront."
          >
            {readOnly ? (
              <KeyValueList
                items={[{ label: "Sales channel", value: CHANNEL_LABELS[values.salesChannel] }]}
              />
            ) : (
              <Field label="Sales channel" id="artwork-channel" disabled={readOnly}>
                <SegmentedControl
                  label="Sales channel"
                  size="md"
                  value={values.salesChannel}
                  onValueChange={(salesChannel) => update({ salesChannel })}
                  options={ADMIN_ARTWORK_CHANNELS.map((value) => ({
                    value,
                    label: CHANNEL_LABELS[value],
                  }))}
                />
              </Field>
            )}
            {record ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2 text-staff-sm text-staff-muted">
                  <span>Now</span>
                  <MappedStatusBadge status={record.state} present={presentArtworkState} />
                  {record.publishedAt && live ? (
                    <span>since {formatStaffDateTime(record.publishedAt)}</span>
                  ) : null}
                </div>
                {record.state === "draft" && record.publishBlockers.length > 0 ? (
                  <Notice tone="warning" title="Not ready to publish">
                    {publishBlockerMessages(record).join(" ")}
                  </Notice>
                ) : null}
                {visibility && !readOnly ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {visibility.primary ? visibilityButton(visibility.primary, "secondary") : null}
                    {visibility.more.map((action) => (
                      <StaffButton
                        key={action}
                        variant={action === "archive" ? "danger-secondary" : "secondary"}
                        icon={<ActionIcon action={action} />}
                        disabled={dirty || changingVisibility}
                        onClick={() => setConfirming(action)}
                      >
                        {VISIBILITY_ACTION_LABELS[action].verb}
                      </StaffButton>
                    ))}
                    {dirty ? (
                      <span className="text-staff-xs text-staff-muted">
                        Save your changes first.
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <Notice title="New artworks start as drafts">
                {prints
                  ? "Create the draft first, then publish it from here when it has an image, a price and confirmed edition facts."
                  : "Create the draft first, then publish it from here when it has an image."}
              </Notice>
            )}
          </FormSection>
        )}

        {companion ? null : readOnly && record ? (
          <ReadOnlySearchListing values={values} />
        ) : (
          <FormSection
            title="Search listing"
            description="How the page appears in search results. Leave blank to use the title and description."
          >
            <Field
              label="Search title"
              optional
              description={counter(values.seoTitle, SEO_TITLE_MAX_LENGTH)}
              error={errors.seoTitle}
              id={artworkFieldId("seoTitle")}
              disabled={readOnly}
            >
              <TextInput
                value={values.seoTitle}
                placeholder={values.title.trim() || "The artwork's title"}
                onChange={(event) => update({ seoTitle: event.target.value })}
              />
            </Field>
            <Field
              label="Search description"
              optional
              description={counter(values.seoDescription, SEO_DESCRIPTION_MAX_LENGTH)}
              error={errors.seoDescription}
              id={artworkFieldId("seoDescription")}
              disabled={readOnly}
            >
              <TextArea
                rows={3}
                value={values.seoDescription}
                onChange={(event) => update({ seoDescription: event.target.value })}
              />
            </Field>
          </FormSection>
        )}

        {prints ? (
          <PrintsConfirmSection
            preview={factsPreviewModel}
            confirmed={factsValues.confirmed}
            saving={saving}
            onConfirmedChange={(confirmed) => updateFacts({ confirmed })}
          />
        ) : null}

        {!canSave ? null : (
          <FormActions className="border-t border-staff-line-subtle pt-4">
            <StaffButton asChild variant="secondary">
              <Link href={companion ? `/artworks/${companion.artworkId}` : "/artworks"}>
                Cancel
              </Link>
            </StaffButton>
            {prints ? null : (
              <StaffButton
                type="submit"
                variant="primary"
                loading={saving}
                disabled={mode === "edit" && !dirty}
              >
                {mode === "create" ? "Create draft" : dirty ? "Save changes" : "Saved"}
              </StaffButton>
            )}
          </FormActions>
        )}
      </form>

      {record && run ? (
        <>
          <EditionRunCard
            artworkId={record.artworkId}
            run={run}
            version={version ?? record.version}
            linkedToOriginal={values.sourceOriginalId !== null}
            canWrite={permissions.write}
            onSaved={setVersion}
          />
          <EditionFactsCard
            artworkId={record.artworkId}
            title={record.title}
            run={run}
            permissions={{ write: permissions.write, correct: permissions.correctFacts }}
          />
          {run.stock && isOpenSpec(run.spec) ? (
            <OpenStockCard
              artworkId={record.artworkId}
              title={record.title}
              stock={run.stock}
              defaultSplit={
                run.spec.type === "open"
                  ? run.spec.defaultSplit
                  : run.spec.type === "companion" && run.spec.run.type === "open"
                    ? run.spec.run.defaultSplit
                    : { artistPct: 50, laxPct: 50 }
              }
              canWrite={permissions.write}
            />
          ) : null}
          {canHaveLinkedListings(run.spec) ? (
            <LinkedListingsCard listings={run.linkedListings} />
          ) : null}
          {canHaveLinkedListings(run.spec) && permissions.write ? (
            <ProofListingDialog
              open={listingProofs}
              onOpenChange={setListingProofs}
              artworkId={record.artworkId}
              title={record.title}
              available={proofsAvailable(run)}
              permissions={{
                setPrice: permissions.setPrice,
                approveHorsCommerce: permissions.approveHorsCommerce,
              }}
            />
          ) : null}
        </>
      ) : null}

      <ConfirmActionDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        title={
          confirming ? `${VISIBILITY_ACTION_LABELS[confirming].verb} “${record?.title ?? ""}”?` : ""
        }
        description={confirming ? VISIBILITY_OUTCOME[confirming] : ""}
        confirmLabel={confirming ? VISIBILITY_ACTION_LABELS[confirming].verb : ""}
        tone={confirming === "archive" ? "danger" : "default"}
        loading={changingVisibility}
        onConfirm={() => confirming && void changeVisibility(confirming)}
      />
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}
