"use client";

import { AdminBreadcrumbs } from "@/components/admin-breadcrumbs";
import { ArtistPicker } from "@/components/artworks/artist-picker.client";
import { ArtworkMediaField } from "@/components/artworks/artwork-media-field.client";
import {
  ReadOnlyDetails,
  ReadOnlyMedia,
  ReadOnlySearchListing,
} from "@/components/artworks/artwork-read-only-sections";
import { useUnsavedNavigationGuard } from "@/components/use-unsaved-changes-guard";
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
  withTitle,
} from "@/lib/artwork-form";
import {
  createArtwork,
  getArtworkDetail,
  saveArtwork,
  saveArtworkPrice,
  setArtworkVisibility,
} from "@/server/application/admin-artwork-actions.server";
import {
  VISIBILITY_OUTCOME,
  artworkVisibilityActions,
  editionAllocationSummary,
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
  ADMIN_ARTWORK_CHANNELS,
  ADMIN_ARTWORK_SALE_STATES,
  type AdminArtworkDetail,
  type AdminArtworkVisibilityAction,
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
  StatGrid,
  TextArea,
  TextInput,
  formatStaffDateTime,
  parsePoundsToPence,
  toast,
} from "@auction/staff-ui";
import { Archive, ArchiveRestore, Eye, EyeOff, Save } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type ArtworkEditorPermissions = {
  /** `catalogue.write`: edit, publish, unpublish, archive. */
  write: boolean;
  /** `artwork_price.write`: set or change the edition price. */
  setPrice: boolean;
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
  permissions,
  currentYear,
}: {
  detail: AdminArtworkDetail | null;
  /** For a new artwork started from an artist's page. */
  initialArtist?: { id: string; name: string } | null;
  permissions: ArtworkEditorPermissions;
  currentYear: number;
}) {
  const router = useRouter();
  const mode = detail ? "edit" : "create";
  const [record, setRecord] = useState(detail);
  const [values, setValues] = useState<ArtworkFormValues>(() =>
    detail
      ? artworkFormValues(detail)
      : {
          ...emptyArtworkForm(),
          artistId: initialArtist?.id ?? null,
          artistName: initialArtist?.name ?? null,
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
  const summaryRef = useRef<HTMLDivElement>(null);

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
  const guard = useUnsavedNavigationGuard(dirty && canSave);
  const attempted = failedSubmits > 0;
  const clientErrors = attempted ? validateArtworkForm(values, context) : {};
  const errors = { ...serverErrors, ...clientErrors };
  const summary = artworkErrorSummary(errors);

  // Move focus to the summary once per failed submit, not on every keystroke after it.
  useEffect(() => {
    if (failedSubmits > 0) summaryRef.current?.focus();
  }, [failedSubmits]);

  function update(patch: Partial<ArtworkFormValues>) {
    setValues((current) => ({ ...current, ...patch }));
    if (Object.keys(serverErrors).length > 0) setServerErrors({});
  }

  async function submit(expectedVersion = version) {
    const found = validateArtworkForm(values, context);
    if (Object.keys(found).length > 0) {
      setFailedSubmits((count) => count + 1);
      return;
    }
    setFormError(null);
    setSaving(true);
    if (mode === "create") {
      const result = await createArtwork({
        body: buildArtworkCreateBody(values, context),
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
  const title = mode === "create" ? values.title.trim() || "New artwork" : record?.title;

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
          record && visibility && visibility.more.length > 0 && !readOnly ? (
            <OverflowMenu
              actions={visibility.more.map((action) => ({
                id: action,
                label: VISIBILITY_ACTION_LABELS[action].verb,
                icon: ACTION_ICON[action],
                tone: action === "archive" ? ("danger" as const) : ("default" as const),
                disabled: dirty,
                onSelect: () => setConfirming(action),
              }))}
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
        className="flex flex-col gap-6 rounded-staff-md border border-staff-line bg-staff-surface p-4 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {summary.length > 0 && attempted ? (
          <div ref={summaryRef} tabIndex={-1} className="outline-none">
            <FormErrorSummary errors={summary} />
          </div>
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
          </FormSection>
        )}

        <FormSection
          title="Editions and pricing"
          description="Editions are sold at one price each. Counts here are for staff only; the storefront shows only whether editions are available."
        >
          {mode === "create" ? (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-staff-sm font-medium text-staff-fg">Edition run</legend>
              <StaffRadioGroup
                value={values.editionRun}
                onValueChange={(editionRun) =>
                  update({ editionRun: editionRun === "original" ? "original" : "editions" })
                }
              >
                <ChoiceRow
                  htmlFor="edition-run-editions"
                  control={<StaffRadio id="edition-run-editions" value="editions" />}
                  label="Original with an edition of 24"
                  description="10 for buyers of the original, 10 for the artist and 4 for LAX. Fixed once created."
                />
                <ChoiceRow
                  htmlFor="edition-run-original"
                  control={<StaffRadio id="edition-run-original" value="original" />}
                  label="Original only"
                  description="A unique work, sold by enquiry. It has no edition price."
                />
              </StaffRadioGroup>
            </fieldset>
          ) : record && record.editions.size > 0 ? (
            <div className="flex flex-col gap-3">
              <KeyValueList
                items={[
                  {
                    label: "Edition run",
                    value: `${record.editions.size} editions · ${editionAllocationSummary(record.editions)}`,
                  },
                ]}
              />
              <StatGrid label="Edition counts" items={editionRunFacts(record.editions)} />
            </div>
          ) : (
            <KeyValueList
              items={[{ label: "Edition run", value: "Original only, sold by enquiry" }]}
            />
          )}

          {values.editionRun === "editions" ? (
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
              disabled={!permissions.setPrice}
            >
              <MoneyInput
                value={typedPence.ok ? typedPence.pence : null}
                onValueChange={() => undefined}
                onInput={(event) => update({ priceText: event.currentTarget.value })}
                placeholder="0.00"
                boxClassName="sm:max-w-60"
              />
            </Field>
          ) : null}

          {readOnly ? (
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

        {readOnly && record ? (
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
                    <span className="text-staff-xs text-staff-muted">Save your changes first.</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <Notice title="New artworks start as drafts">
              Create the draft first, then publish it from here when it has an image and a price.
            </Notice>
          )}
        </FormSection>

        {readOnly && record ? (
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

        {!canSave ? null : (
          <FormActions className="border-t border-staff-line-subtle pt-4">
            <StaffButton asChild variant="secondary">
              <Link href="/artworks">Cancel</Link>
            </StaffButton>
            <StaffButton
              type="submit"
              variant="primary"
              loading={saving}
              disabled={mode === "edit" && !dirty}
            >
              {mode === "create" ? "Create draft" : dirty ? "Save changes" : "Saved"}
            </StaffButton>
          </FormActions>
        )}
      </form>

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
      <ConfirmActionDialog
        open={guard.pending}
        onOpenChange={(open) => {
          if (!open) guard.stay();
        }}
        title="Leave without saving?"
        description="Your changes to this artwork have not been saved and will be lost."
        confirmLabel="Leave without saving"
        tone="danger"
        onConfirm={guard.leave}
      />
    </div>
  );
}
