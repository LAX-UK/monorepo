"use client";

import { ArtEnquiryConfirmation } from "@/components/enquiry/art-enquiry-confirmation";
import { ArtEnquiryForm } from "@/components/enquiry/art-enquiry-form.client";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ArtEnquiryContact } from "@/lib/artwork/artwork-detail-page.composer";
import { sendArtEnquiry } from "@/lib/enquiry/art-enquiry-actions.server";
import type { EnquiryConfirmationVm } from "@/lib/enquiry/enquiry-confirmation.vm";
import { ENQUIRY_MESSAGE_MAX_LENGTH } from "@/lib/enquiry/enquiry-form.validator";
import type { ArtEnquiryState } from "@/lib/enquiry/submit-art-enquiry";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingSideSheet } from "@auction/marketing-ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import type { ReactNode } from "react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";

export type ArtEnquirySheetProps = {
  artworkSlug: string;
  artworkTitle: string;
  artistName: string;
  imageUrl: string | null;
  contact: ArtEnquiryContact;
  /** Opened from a card “Enquire” link (`?enquire=1`). */
  autoOpen: boolean;
  /** The designed sent state: what happens next and the way on. */
  confirmation: EnquiryConfirmationVm;
  /** Trigger text; defaults to "Enquire". */
  triggerLabel?: ReactNode;
};

const INITIAL_STATE: ArtEnquiryState = { status: "idle" };

function clearEnquireParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("enquire")) return;
  url.searchParams.delete("enquire");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/** Figma 531:8496 (desktop panel), 531:9043 (mobile sheet), 616:12737 (sent). */
export function ArtEnquirySheet({
  artworkSlug,
  artworkTitle,
  artistName,
  imageUrl,
  contact,
  autoOpen,
  triggerLabel = "Enquire",
  confirmation,
}: ArtEnquirySheetProps) {
  const [open, setOpen] = useState(autoOpen);
  const action = useMemo(() => sendArtEnquiry.bind(null, artworkSlug), [artworkSlug]);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sentRef = useRef<HTMLOutputElement>(null);
  const sent = state.status === "sent";

  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) clearEnquireParam();
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        size="lg"
        className="min-h-11 w-full font-label"
        onClick={() => setOpen(true)}
        data-testid="art-enquire-trigger"
      >
        {triggerLabel}
      </Button>
      <MarketingSideSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Send an enquiry"
        titleCase="sentence"
        returnFocusRef={triggerRef}
      >
        <div data-testid="art-enquiry-sheet">
          {state.status === "sent" ? (
            <ArtEnquiryConfirmation
              ref={sentRef}
              vm={confirmation}
              email={state.email}
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <p className="text-base leading-6 text-on-surface">
                Ask about price, condition, framing or delivery. The gallery team replies within one
                working day, and every enquiry is handled with discretion.
              </p>
              <div className="flex items-center gap-4 border-y border-border-hairline py-4">
                <ArtMediaImage
                  src={imageUrl}
                  alt=""
                  label={ART_MEDIA_LABELS.artwork}
                  aspect={[1, 1]}
                  sizes="80px"
                  className="size-16 shrink-0"
                  imgClassName="object-cover"
                />
                <div className="min-w-0">
                  <p className="font-headline text-lg font-medium leading-6 text-on-surface">
                    {artworkTitle}
                  </p>
                  <p className="text-sm text-on-surface-variant">{artistName}</p>
                </div>
              </div>
              <ArtEnquiryForm
                action={formAction}
                pending={pending}
                contact={contact}
                serverErrors={state.status === "invalid" ? state.fieldErrors : {}}
                messageRequired={false}
                messageMaxLength={ENQUIRY_MESSAGE_MAX_LENGTH}
                notice={
                  state.status === "error" ? (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription>{state.message}</AlertDescription>
                    </Alert>
                  ) : null
                }
              />
            </div>
          )}
        </div>
      </MarketingSideSheet>
    </>
  );
}
