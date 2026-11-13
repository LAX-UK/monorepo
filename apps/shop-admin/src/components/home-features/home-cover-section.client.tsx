"use client";

import { useStaffCatalogueImage } from "@/components/artworks/staff-catalogue-image-provider.client";
import {
  EditorialTextArea,
  editorialFieldId,
} from "@/components/editorial/editorial-field-parts.client";
import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  HOME_COVER_COPY,
  type HomeCoverDraft,
  type HomeCoverProblem,
  draftDiffersFromSaved,
  draftFromSaved,
  draftIsMeasured,
  homeCoverDraftProblems,
  homeCoverIssueProblems,
  homeCoverPlacementLine,
  suggestedAlt,
} from "@/lib/home-cover";
import { uploadShopMediaFile } from "@/lib/shop-media-upload.client";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import type { AdminHomeCover, AdminHomeCoverPictureCandidate } from "@auction/shop-contracts";
import {
  CellThumbnail,
  ConfirmActionDialog,
  type EntityOption,
  EntityPicker,
  Field,
  FileDropzone,
  FocalPointPicker,
  FormActions,
  FormErrorSummary,
  Notice,
  StaffButton,
  StatusBadge,
  describeFocal,
  toast,
  useBeforeUnloadGuard,
  useStaffCan,
} from "@auction/staff-ui";
import { ImagePlus, Save, Trash2 } from "@auction/staff-ui/icons";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

const PICTURE_FIELD = "home-cover-picture";
const ALT_FIELD = "home-cover-alt";
const ACCEPT = "image/jpeg,image/png,image/webp";

/** The server calls the section needs; passed in so it can be tested without a server. */
export type HomeCoverActions = {
  search: (query: string) => Promise<AdminHomeCoverPictureCandidate[]>;
  save: (input: {
    mediaKey: string;
    alt: string;
    focal: { x: number; y: number };
    idempotencyKey: string;
  }) => Promise<AdminMutationResult<AdminHomeCover>>;
  remove: (input: { idempotencyKey: string }) => Promise<AdminMutationResult<AdminHomeCover>>;
};

type Upload = { fileName: string; progress: number } | null;

function StateBadge({ dirty, inUse }: { dirty: boolean; inUse: boolean }) {
  if (dirty) return <StatusBadge tone="warning">Unsaved changes</StatusBadge>;
  return inUse ? (
    <StatusBadge tone="success">In use</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Not set</StatusBadge>
  );
}

function Facts({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-1 text-staff-sm text-staff-muted">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * The Shop home's cover image: the picture staff chose, where its subject sits and its alt text.
 * Choose one of the Shop's pictures or upload one, mark the subject, then save; the headline is
 * checked against the picture when it is saved and the result is shown. Read-only without
 * `actions`. A refused save marks the picture or the alt text and keeps what was entered.
 */
export function HomeCoverSection({
  saved,
  actions,
  onSaved,
}: {
  /** `null` when the cover could not be read; the section then says so and nothing else is affected. */
  saved: AdminHomeCover | null;
  actions?: HomeCoverActions;
  onSaved?: (cover: AdminHomeCover) => void;
}) {
  if (!saved) return <HomeCoverUnavailable />;
  return (
    <HomeCoverEditor
      saved={saved}
      {...(actions ? { actions } : {})}
      {...(onSaved ? { onSaved } : {})}
    />
  );
}

function HomeCoverUnavailable() {
  return (
    <section
      aria-labelledby="home-cover-heading"
      className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
    >
      <h2 id="home-cover-heading" className="font-staff text-staff-md font-semibold text-staff-fg">
        {HOME_COVER_COPY.title}
      </h2>
      <Notice tone="warning" title="The cover image could not be loaded">
        The prints, artists and categories below are not affected. Reload the page to try again.
      </Notice>
    </section>
  );
}

function HomeCoverEditor({
  saved,
  actions,
  onSaved,
}: {
  saved: AdminHomeCover;
  actions?: HomeCoverActions;
  onSaved?: (cover: AdminHomeCover) => void;
}) {
  const resolveImage = useStaffCatalogueImage();
  const canUpload = useStaffCan("catalogue.write");
  const [current, setCurrent] = useState(saved);
  const [draft, setDraft] = useState<HomeCoverDraft | null>(
    saved.cover ? draftFromSaved(saved.cover) : null,
  );
  const [problems, setProblems] = useState<HomeCoverProblem[]>([]);
  const [submitCount, setSubmitCount] = useState(0);
  const [notice, setNotice] = useState<{ text: string; stepUp: boolean } | null>(null);
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [upload, setUpload] = useState<Upload>(null);
  const [uploadFailure, setUploadFailure] = useState<string | null>(null);
  const [saveKey, setSaveKey] = useState(() => crypto.randomUUID());
  const [removeKey, setRemoveKey] = useState(() => crypto.randomUUID());
  const candidates = useRef(new Map<string, AdminHomeCoverPictureCandidate>());

  const cover = current.cover;
  const dirty = draftDiffersFromSaved(draft, cover);
  useBeforeUnloadGuard(dirty);

  const change = (next: HomeCoverDraft | null) => {
    setDraft(next);
    setProblems([]);
    setNotice(null);
  };

  const searchOptions = useCallback(
    async (query: string): Promise<EntityOption[]> => {
      if (!actions) return [];
      const results = await actions.search(query);
      return results.map((item) => {
        candidates.current.set(item.mediaKey, item);
        return {
          id: item.mediaKey,
          label: item.artworkTitle,
          description: item.artistName,
          leading: <CellThumbnail src={resolveImage(item.imageUrl)} label="Picture" />,
        };
      });
    },
    [actions, resolveImage],
  );

  async function take(files: File[]) {
    const file = files[0];
    if (!file) return;
    setUploadFailure(null);
    setUpload({ fileName: file.name, progress: 0 });
    try {
      const confirmed = await uploadShopMediaFile({
        kind: "editorial_cover",
        file,
        onProgress: (loaded, total) =>
          setUpload({
            fileName: file.name,
            progress: total > 0 ? Math.round((loaded / total) * 100) : 0,
          }),
      });
      change({
        mediaKey: confirmed.key,
        imageUrl: confirmed.publicUrl,
        width: confirmed.width,
        height: confirmed.height,
        alt: "",
        focal: { x: 0.5, y: 0.5 },
      });
    } catch (error) {
      setUploadFailure(error instanceof Error ? error.message : "The upload failed. Try again.");
    } finally {
      setUpload(null);
    }
  }

  async function save() {
    if (!actions || !draft) return;
    setSubmitCount((count) => count + 1);
    const blocking = homeCoverDraftProblems(draft, current.minimumWidth);
    if (blocking.length > 0) {
      setProblems(blocking);
      return;
    }
    setPending(true);
    setNotice(null);
    let result: AdminMutationResult<AdminHomeCover>;
    try {
      result = await actions.save({
        mediaKey: draft.mediaKey,
        alt: draft.alt.trim(),
        focal: draft.focal,
        idempotencyKey: saveKey,
      });
    } catch {
      result = { ok: false, kind: "failed", message: "Could not save the cover image. Try again." };
    } finally {
      setPending(false);
    }
    if (!result.ok) {
      const named =
        result.kind === "validation"
          ? homeCoverIssueProblems(result.issues, {
              width: draft.width,
              minimumWidth: current.minimumWidth,
            })
          : [];
      setProblems(named);
      if (named.length === 0) {
        setNotice({
          text: adminMutationErrorMessage(result),
          stepUp: result.kind === "step_up_required",
        });
      }
      return;
    }
    setSaveKey(crypto.randomUUID());
    setProblems([]);
    setCurrent(result.data);
    setDraft(result.data.cover ? draftFromSaved(result.data.cover) : null);
    onSaved?.(result.data);
    toast.success("Cover image saved");
  }

  async function remove() {
    if (!actions) return;
    setPending(true);
    let result: AdminMutationResult<AdminHomeCover>;
    try {
      result = await actions.remove({ idempotencyKey: removeKey });
    } catch {
      result = {
        ok: false,
        kind: "failed",
        message: "Could not remove the cover image. Try again.",
      };
    } finally {
      setPending(false);
      setRemoving(false);
    }
    if (!result.ok) {
      setNotice({
        text: adminMutationErrorMessage(result),
        stepUp: result.kind === "step_up_required",
      });
      return;
    }
    setRemoveKey(crypto.randomUUID());
    setCurrent(result.data);
    setDraft(null);
    setProblems([]);
    onSaved?.(result.data);
    toast.success("Cover image removed");
  }

  const pictureProblem = problems.find((problem) => problem.field === "mediaKey")?.message;
  const altProblem = problems.find((problem) => problem.field === "alt")?.message;
  const measured = draftIsMeasured(draft, cover);
  const ratio = draft?.width && draft.height ? draft.width / draft.height : undefined;
  const headingId = "home-cover-heading";

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-surface p-4 sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id={headingId}
            tabIndex={-1}
            className="staff-focus rounded-staff-xs font-staff text-staff-md font-semibold text-staff-fg"
          >
            {HOME_COVER_COPY.title}
          </h2>
          <StateBadge dirty={dirty} inUse={Boolean(cover)} />
        </div>
        <p className="text-staff-sm text-staff-muted">{HOME_COVER_COPY.description}</p>
      </div>

      {!actions && !cover ? (
        <p className="rounded-staff-lg border border-dashed border-staff-line px-4 py-6 text-center text-staff-sm text-staff-muted">
          {HOME_COVER_COPY.emptyReadOnly}
        </p>
      ) : null}

      {!draft && actions ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={HOME_COVER_COPY.pickerFieldLabel}
            id={editorialFieldId("home-cover-choose")}
          >
            <EntityPicker
              value={null}
              onValueChange={(option) => {
                const item = option ? candidates.current.get(option.id) : undefined;
                if (!item) return;
                change({
                  mediaKey: item.mediaKey,
                  imageUrl: resolveImage(item.imageUrl) ?? item.imageUrl,
                  width: null,
                  height: null,
                  alt: suggestedAlt(item.artworkTitle, item.artistName),
                  focal: { x: 0.5, y: 0.5 },
                });
              }}
              search={searchOptions}
              placeholder={HOME_COVER_COPY.pickerPlaceholder}
              searchPlaceholder="Search by edition or artist"
              emptyText="No pictures match."
              disabled={pending}
              aria-label={HOME_COVER_COPY.pickerLabel}
            />
          </Field>
          <Field
            label={HOME_COVER_COPY.uploadFieldLabel}
            id={editorialFieldId("home-cover-upload")}
            error={uploadFailure ?? undefined}
          >
            {canUpload ? (
              <div className="flex flex-col gap-2">
                <FileDropzone
                  label={HOME_COVER_COPY.uploadLabel}
                  hint={`JPEG, PNG or WebP, at least ${current.minimumWidth} px wide.`}
                  accept={ACCEPT}
                  disabled={pending || upload !== null}
                  onFiles={(files) => void take(files)}
                />
                {upload ? (
                  <output className="flex items-center gap-3 rounded-staff-lg border border-staff-line px-3 py-2 text-staff-sm">
                    <span className="min-w-0 flex-1 truncate text-staff-fg">{upload.fileName}</span>
                    <span className="shrink-0 text-staff-xs text-staff-muted tabular-nums">
                      {upload.progress}%
                    </span>
                  </output>
                ) : null}
              </div>
            ) : (
              <p className="text-staff-sm text-staff-muted">
                Uploading needs catalogue access. Choose a Shop picture instead.
              </p>
            )}
          </Field>
        </div>
      ) : null}

      {draft ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <FormErrorSummary
              errors={problems.map((problem) => ({
                fieldId: problem.field === "alt" ? editorialFieldId(ALT_FIELD) : PICTURE_FIELD,
                message: problem.message,
              }))}
              title="Fix this before saving"
              focusKey={submitCount}
            />
            <Field
              label={HOME_COVER_COPY.pictureLabel}
              id={PICTURE_FIELD}
              {...(actions ? { description: HOME_COVER_COPY.focalHint } : {})}
              error={pictureProblem}
            >
              <FocalPointPicker
                src={draft.imageUrl}
                ratio={ratio}
                value={draft.focal}
                label={HOME_COVER_COPY.focalLabel}
                disabled={!actions || pending}
                onValueChange={(focal) => actions && change({ ...draft, focal })}
                onImageSize={(size) => {
                  if (draft.width === null) setDraft({ ...draft, ...size });
                }}
              />
            </Field>
            <p className="text-staff-xs text-staff-muted">Subject: {describeFocal(draft.focal)}.</p>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {actions ? (
              <EditorialTextArea
                name={ALT_FIELD}
                label={HOME_COVER_COPY.altLabel}
                description={HOME_COVER_COPY.altHint}
                value={draft.alt}
                onChange={(alt) => change({ ...draft, alt })}
                error={altProblem}
                disabled={pending}
                maxLength={500}
                rows={3}
              />
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-staff-sm font-medium text-staff-fg">
                  {HOME_COVER_COPY.altLabel}
                </span>
                <p className="text-staff-sm text-staff-fg">{draft.alt}</p>
              </div>
            )}
            <Facts
              items={[
                ...(draft.width && draft.height ? [`${draft.width} × ${draft.height} px`] : []),
                cover && measured
                  ? homeCoverPlacementLine(cover)
                  : "The headline is checked against the picture when you save.",
              ]}
            />
            {actions ? (
              <div>
                <StaffButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<ImagePlus aria-hidden />}
                  disabled={pending}
                  onClick={() => change(null)}
                >
                  Choose another picture
                </StaffButton>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {notice ? (
        <Notice
          tone="danger"
          alert
          title={notice.text}
          {...(notice.stepUp
            ? {
                actions: (
                  <StaffButton asChild size="sm" variant="secondary">
                    <Link href="/api/auth/login?returnTo=%2Feditorial%2Ffeatured">
                      Sign in again
                    </Link>
                  </StaffButton>
                ),
              }
            : {})}
        />
      ) : null}

      {actions && (draft || cover) ? (
        <FormActions
          start={
            cover ? (
              <StaffButton
                type="button"
                variant="ghost"
                icon={<Trash2 aria-hidden />}
                disabled={pending}
                onClick={() => setRemoving(true)}
              >
                Remove cover image
              </StaffButton>
            ) : undefined
          }
        >
          {dirty ? (
            <StaffButton
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => change(cover ? draftFromSaved(cover) : null)}
            >
              Discard changes
            </StaffButton>
          ) : null}
          {draft ? (
            <StaffButton
              type="button"
              variant="primary"
              icon={<Save aria-hidden />}
              {...(dirty || pending ? {} : { disabledReason: "No changes to save" })}
              loading={pending}
              onClick={() => void save()}
            >
              {pending ? "Saving…" : "Save cover image"}
            </StaffButton>
          ) : null}
        </FormActions>
      ) : null}

      <ConfirmActionDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Remove the cover image?"
        description="The Shop home will lead with the newest release again, at once. The picture stays in the media library."
        confirmLabel="Remove cover image"
        tone="danger"
        loading={pending}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
