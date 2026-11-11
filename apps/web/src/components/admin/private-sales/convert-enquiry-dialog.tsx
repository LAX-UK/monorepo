"use client";

import {
  convertEnquiryAction,
  searchDealArtworksAction,
} from "@/lib/actions/admin/admin-private-sales";
import { isStaleDeal } from "@/lib/admin/private-sales/private-sale-errors";
import {
  Field,
  FormErrorSummary,
  Notice,
  StaffButton,
  StaffDialog,
  TextInput,
} from "@auction/staff-ui";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ARTWORK_REFUSED,
  ARTWORK_REQUIRED,
  type ArtworkChoice,
  artworkChoiceError,
  artworkConvertInput,
  defaultArtworkChoice,
} from "./artwork-choice";
import { RegisterArtworkField } from "./register-artwork-field";
import type { SearchRegisterArtworks } from "./register-artwork-picker";
import { useEarlierLotArtwork } from "./use-earlier-lot-artwork";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  /** A buy enquiry names the work it is about; a sell enquiry brings its own. */
  needsWork: boolean;
  onReload: () => void;
  onDone: (dealReference: string) => void;
  convert?: typeof convertEnquiryAction;
  searchArtworks?: typeof searchDealArtworksAction;
};

const WORK_REFERENCE = /^C-?\d{1,15}$/i;

/**
 * Turns a private sale enquiry into a proposed deal. A sell enquiry opens a draft consignment for
 * the work with the sender as seller; a buy enquiry names the work the buyer is being offered, by
 * its consignment reference. Either says which artwork the deal is for: an original from the
 * register, which is held for the deal from the moment it opens, or why it is not there. The
 * sender needs an account, because the checks that gate the deal are recorded against one, and
 * the enquiry then belongs to its deal.
 */
export function ConvertEnquiryDialog({
  open,
  onOpenChange,
  reference,
  needsWork,
  onReload,
  onDone,
  convert = convertEnquiryAction,
  searchArtworks = searchDealArtworksAction,
}: Props) {
  const ids = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [work, setWork] = useState("");
  const [choice, setChoice] = useState<ArtworkChoice>(() => defaultArtworkChoice(needsWork));
  const [earlierLot, setEarlierLot] = useState<{
    artworkId: string;
    workReference: string;
  } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    stale: boolean;
    refusedArtwork: boolean;
  } | null>(null);
  // The artwork the register refused stays chosen, with a reason to pick another.
  const [refusedId, setRefusedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // The API found no artwork choice in the request: shown with the Artwork field, not as a banner.
  const [choiceMissing, setChoiceMissing] = useState(false);
  // Once staff choose for themselves, the earlier lot's artwork no longer replaces their choice.
  const chosenByStaff = useRef(false);

  useEffect(() => {
    if (!open) return;
    setWork("");
    setChoice(defaultArtworkChoice(needsWork));
    setEarlierLot(null);
    setAttempts(0);
    setFailure(null);
    setRefusedId(null);
    setChoiceMissing(false);
    chosenByStaff.current = false;
  }, [open, needsWork]);

  const workReference = WORK_REFERENCE.test(work.trim()) ? work.trim() : null;
  const attempted = attempts > 0;

  const search = useCallback<SearchRegisterArtworks>(
    async (query) => {
      const result = await searchArtworks({
        q: query,
        enquiry: reference,
        ...(workReference ? { work: workReference } : {}),
      });
      if (!result.ok || !result.data) throw new Error(result.ok ? "No answer" : result.error);
      return result.data;
    },
    [searchArtworks, reference, workReference],
  );

  useEarlierLotArtwork({
    enabled: open && needsWork && choice.mode === "register" && !chosenByStaff.current,
    workReference,
    search,
    onFound: useCallback((artwork, found) => {
      setChoice({ mode: "register", artwork });
      setEarlierLot({ artworkId: artwork.id, workReference: found });
    }, []),
  });

  const workError =
    attempted && needsWork && !workReference
      ? "Enter the reference of the work, such as C-1042."
      : undefined;
  const choiceError =
    attempted && artworkChoiceError(choice)
      ? artworkChoiceError(choice)
      : choiceMissing
        ? ARTWORK_REQUIRED
        : choice.mode === "register" && choice.artwork && choice.artwork.id === refusedId
          ? ARTWORK_REFUSED
          : undefined;
  // One field needs no summary; two or more get one, with every message also beside its field.
  const summary = [
    ...(workError ? [{ fieldId: `${ids}-work`, message: workError }] : []),
    ...(choiceError && needsWork ? [{ fieldId: `${ids}-artwork`, message: choiceError }] : []),
  ];

  function chooseArtwork(next: ArtworkChoice) {
    chosenByStaff.current = true;
    setChoiceMissing(false);
    setChoice(next);
  }

  async function proceed() {
    setAttempts((count) => count + 1);
    if ((needsWork && !workReference) || artworkChoiceError(choice)) return;
    setFailure(null);
    setBusy(true);
    const result = await convert(reference, {
      ...(needsWork && workReference ? { workReference } : {}),
      ...artworkConvertInput(choice),
    });
    setBusy(false);
    if (result.ok && result.data) {
      onOpenChange(false);
      onDone(result.data.reference);
    } else if (!result.ok && result.errorCode === "artwork_choice_required") {
      setChoiceMissing(true);
    } else if (!result.ok) {
      const refusedArtwork = result.errorCode === "artwork_unavailable";
      if (refusedArtwork && choice.mode === "register" && choice.artwork) {
        setRefusedId(choice.artwork.id);
        // Someone else took it first: ask the register again so the list tells the truth.
        setRefreshKey((key) => key + 1);
      }
      setFailure({
        message: result.error,
        stale: isStaleDeal(result.errorCode),
        refusedArtwork,
      });
    }
  }

  return (
    <StaffDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      size="md"
      initialFocusRef={cancelRef}
      title={`Convert ${reference} to a deal`}
      description={
        needsWork
          ? "Opens a proposed deal for the buyer. The enquiry then belongs to the deal and can't be reopened."
          : "Opens a draft consignment for the work and a proposed deal with the sender as seller. The enquiry then belongs to the deal and can't be reopened."
      }
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
            Convert to deal
          </StaffButton>
        </>
      }
    >
      <form
        id={`${ids}-form`}
        noValidate
        aria-label={`Convert ${reference} to a deal`}
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
              title="This enquiry changed"
              actions={
                <StaffButton size="sm" variant="secondary" onClick={onReload}>
                  Reload
                </StaffButton>
              }
            >
              Someone else changed this enquiry while you had it open. Reload to see their changes;
              nothing was converted.
            </Notice>
          ) : (
            <Notice
              tone="danger"
              alert
              title={
                failure.refusedArtwork
                  ? "That artwork can't be held for this deal"
                  : "The enquiry couldn't be converted"
              }
            >
              {failure.message}
            </Notice>
          )
        ) : null}
        {needsWork ? (
          <Field
            label="Work"
            id={`${ids}-work`}
            description="The consignment reference of the work this buyer is asking about."
            error={workError}
            disabled={busy}
          >
            <TextInput
              value={work}
              placeholder="C-1042"
              autoComplete="off"
              onChange={(event) => setWork(event.target.value)}
            />
          </Field>
        ) : null}
        <RegisterArtworkField
          id={`${ids}-artwork`}
          value={choice}
          onChange={chooseArtwork}
          search={search}
          error={choiceError}
          earlierLot={earlierLot}
          startReason={needsWork ? null : "sellers_own_work"}
          refreshKey={refreshKey}
          disabled={busy}
        />
      </form>
    </StaffDialog>
  );
}
