"use client";

import {
  searchDealArtworksAction,
  setDealArtworkAction,
} from "@/lib/actions/admin/admin-private-sales";
import { isStaleDeal } from "@/lib/admin/private-sales/private-sale-errors";
import type { DealRecord } from "@/lib/data/http/admin-private-sales.schema";
import {
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  TextArea,
} from "@auction/staff-ui";
import { type DealArtworkLock, dealArtworkLockSchema } from "@auction/validators";
import type { DealArtworkOption } from "@auction/validators";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ARTWORK_REFUSED } from "./artwork-choice";
import { ArtworkReviewCard } from "./artwork-review-card";
import { LockRefusalNotice } from "./lock-refusal-notice";
import { RegisterArtworkPicker, type SearchRegisterArtworks } from "./register-artwork-picker";

export type DealArtworkMode = "link" | "change";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: DealArtworkMode;
  deal: DealRecord;
  onReload: () => void;
  onDone: (mode: DealArtworkMode) => void;
  set?: typeof setDealArtworkAction;
  searchArtworks?: typeof searchDealArtworksAction;
};

const COPY = {
  link: {
    title: (ref: string) => `Link the artwork to ${ref}`,
    description:
      "Holds the artwork for this deal, so nothing else can offer it while the deal is open.",
    label: "Artwork",
    confirm: "Link and hold",
    missing: "Choose the artwork to hold for this deal.",
  },
  change: {
    title: (ref: string) => `Change the artwork on ${ref}`,
    description: (current: string) =>
      `Releases ${current} and holds the new artwork, in one step. If the new one can't be held, nothing changes.`,
    label: "New artwork",
    confirm: "Change artwork",
    missing: "Choose the new artwork.",
  },
} as const;

const REASON_MISSING = "Say why the artwork is being changed.";

type Failure = {
  message: string;
  stale: boolean;
  lock: DealArtworkLock | null;
  refused: boolean;
};

/**
 * Links an artwork to a deal or changes it. The register decides whether the artwork can be held,
 * in the same step as the deal's change: a refusal shows its own words and link, keeps what staff
 * chose, and asks the register again so the list tells the truth. A change says why; the reason is
 * kept in the deal's history. One field needs no summary; a change has two, so it gets one.
 */
export function DealArtworkDialog({
  open,
  onOpenChange,
  mode,
  deal,
  onReload,
  onDone,
  set = setDealArtworkAction,
  searchArtworks = searchDealArtworksAction,
}: Props) {
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [artwork, setArtwork] = useState<DealArtworkOption | null>(null);
  const [reason, setReason] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [refusedId, setRefusedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    setArtwork(null);
    setReason("");
    setAttempts(0);
    setFailure(null);
    setRefusedId(null);
  }, [open]);

  const copy = COPY[mode];
  const current = deal.artwork?.title ?? "the current artwork";
  const attempted = attempts > 0;

  const search = useCallback<SearchRegisterArtworks>(
    async (query) => {
      const result = await searchArtworks({
        q: query,
        ...(deal.sourceEnquiryReference ? { enquiry: deal.sourceEnquiryReference } : {}),
        ...(deal.work.reference ? { work: deal.work.reference } : {}),
      });
      if (!result.ok || !result.data) throw new Error(result.ok ? "No answer" : result.error);
      return result.data;
    },
    [searchArtworks, deal.sourceEnquiryReference, deal.work.reference],
  );

  const refused = artwork !== null && artwork.id === refusedId;
  const artworkError = refused
    ? mode === "change"
      ? `${ARTWORK_REFUSED} ${current} is still held for this deal.`
      : ARTWORK_REFUSED
    : attempted && !artwork
      ? copy.missing
      : undefined;
  const reasonError = attempted && mode === "change" && !reason.trim() ? REASON_MISSING : undefined;
  const summary = [
    ...(artworkError && mode === "change"
      ? [{ fieldId: `${ids}-artwork`, message: artworkError }]
      : []),
    ...(reasonError ? [{ fieldId: `${ids}-reason`, message: reasonError }] : []),
  ];

  async function proceed() {
    setAttempts((count) => count + 1);
    if (!artwork || (mode === "change" && !reason.trim())) return;
    setFailure(null);
    setBusy(true);
    const result = await set(deal.reference, {
      version: deal.version,
      artworkRegisterId: artwork.id,
      ...(mode === "change" ? { reason: reason.trim() } : {}),
    });
    setBusy(false);
    if (result.ok) {
      onOpenChange(false);
      onDone(mode);
      return;
    }
    const lock = dealArtworkLockSchema.safeParse(result.meta?.lock);
    const isRefused = result.errorCode === "artwork_unavailable";
    if (isRefused) {
      setRefusedId(artwork.id);
      // Someone else took it first: ask the register again so the list tells the truth.
      setRefreshKey((key) => key + 1);
    }
    setFailure({
      message: result.error,
      stale: isStaleDeal(result.errorCode),
      lock: lock.success ? lock.data : null,
      refused: isRefused,
    });
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      initialFocusRef={cancelRef}
      title={copy.title(deal.reference)}
      description={mode === "change" ? COPY.change.description(current) : COPY.link.description}
      footer={
        <>
          <StaffButton
            ref={cancelRef}
            variant="secondary"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </StaffButton>
          <StaffButton type="submit" form={`${ids}-form`} variant="primary" loading={busy}>
            {copy.confirm}
          </StaffButton>
        </>
      }
    >
      <form
        id={`${ids}-form`}
        noValidate
        aria-label={copy.title(deal.reference)}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void proceed();
        }}
      >
        <FormErrorSummary errors={summary} focusKey={attempts} />
        {failure ? (
          failure.stale ? (
            <Notice
              tone="warning"
              alert
              title="This private sale changed"
              actions={
                <StaffButton size="sm" variant="secondary" onClick={onReload}>
                  Reload
                </StaffButton>
              }
            >
              Someone else changed this deal while you had it open. Reload to see their changes;
              nothing was changed.
            </Notice>
          ) : failure.refused ? (
            <LockRefusalNotice message={failure.message} lock={failure.lock} />
          ) : (
            <Notice tone="danger" alert title="The artwork couldn't be changed">
              {failure.message}
            </Notice>
          )
        ) : null}
        <Field label={copy.label} id={`${ids}-artwork`} error={artworkError} disabled={busy}>
          <RegisterArtworkPicker
            aria-label={copy.label}
            value={artwork}
            onChange={setArtwork}
            search={search}
            invalid={Boolean(artworkError)}
            disabled={busy}
            refreshKey={refreshKey}
          />
        </Field>
        {artwork ? <ArtworkReviewCard artwork={artwork} /> : null}
        {mode === "change" ? (
          <Field
            label="Reason"
            id={`${ids}-reason`}
            description="Shown in the deal's history. Don't paste the clients' personal details."
            error={reasonError}
            disabled={busy}
          >
            <TextArea
              rows={3}
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        ) : null}
      </form>
    </StaffDialog>
  );
}
