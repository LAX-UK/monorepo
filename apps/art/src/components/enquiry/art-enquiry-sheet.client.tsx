"use client";

import type { ArtEnquiryContact } from "@/lib/artwork/artwork-detail-page.composer";
import { sendArtEnquiry } from "@/lib/enquiry/art-enquiry-actions.server";
import { ENQUIRY_MESSAGE_MAX_LENGTH } from "@/lib/enquiry/enquiry-form.validator";
import type { ArtEnquiryState } from "@/lib/enquiry/submit-art-enquiry";
import { MarketingSideSheet } from "@auction/marketing-ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { Textarea } from "@auction/ui/components/textarea";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";

export type ArtEnquirySheetProps = {
  artworkSlug: string;
  artworkTitle: string;
  contact: ArtEnquiryContact;
  /** Opened from a card “Enquire” link or a sign-in round trip (`?enquire=1`). */
  autoOpen: boolean;
  loginHref: string;
};

const INITIAL_STATE: ArtEnquiryState = { status: "idle" };

function clearEnquireParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("enquire")) return;
  url.searchParams.delete("enquire");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function ArtEnquirySheet({
  artworkSlug,
  artworkTitle,
  contact,
  autoOpen,
  loginHref,
}: ArtEnquirySheetProps) {
  const [open, setOpen] = useState(autoOpen);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState(contact.phone);
  const action = useMemo(() => sendArtEnquiry.bind(null, artworkSlug), [artworkSlug]);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const formId = useId();
  const phoneErrorId = `${formId}-phone-error`;
  const messageErrorId = `${formId}-message-error`;
  const messageCountId = `${formId}-message-count`;
  const fieldErrors = state.status === "invalid" ? state.fieldErrors : {};
  const sent = state.status === "sent";

  useEffect(() => {
    if (
      state.status === "sent" ||
      state.status === "error" ||
      state.status === "sign_in_required"
    ) {
      noticeRef.current?.focus();
    }
  }, [state]);

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
        className="min-h-11 w-full font-label uppercase tracking-wide sm:w-auto"
        onClick={() => setOpen(true)}
        data-testid="art-enquire-trigger"
      >
        Enquire
      </Button>
      <MarketingSideSheet
        open={open}
        onOpenChange={onOpenChange}
        title="Enquire about this work"
        description={artworkTitle}
        returnFocusRef={triggerRef}
        footer={
          sent ? (
            <div className="px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full font-label uppercase"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </div>
          ) : (
            <div className="px-6 py-4">
              <Button
                type="submit"
                form={formId}
                disabled={pending}
                aria-disabled={pending}
                className="min-h-11 w-full font-label uppercase tracking-wide"
              >
                {pending ? "Sending…" : "Send enquiry"}
              </Button>
            </div>
          )
        }
      >
        <div className="flex flex-col gap-5" data-testid="art-enquiry-sheet">
          {state.status === "sent" ? (
            <Alert variant="success" ref={noticeRef} tabIndex={-1}>
              <AlertTitle>Enquiry sent</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "error" ? (
            <Alert variant="destructive" ref={noticeRef} tabIndex={-1}>
              <AlertTitle>Enquiry not sent</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "sign_in_required" ? (
            <Alert variant="warning" ref={noticeRef} tabIndex={-1}>
              <AlertTitle>Sign in required</AlertTitle>
              <AlertDescription>
                {state.message}{" "}
                <a href={loginHref} className="art-focus-ring font-medium underline">
                  Sign in
                </a>
              </AlertDescription>
            </Alert>
          ) : null}

          {sent ? null : (
            <form id={formId} action={formAction} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-name`}>Name</Label>
                <Input id={`${formId}-name`} value={contact.name} readOnly autoComplete="name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-email`}>Email</Label>
                <Input
                  id={`${formId}-email`}
                  type="email"
                  value={contact.email}
                  readOnly
                  autoComplete="email"
                />
                <p className="text-xs text-on-surface-variant">
                  Name and email come from your LAX account.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-phone`}>Phone (optional)</Label>
                <Input
                  id={`${formId}-phone`}
                  name="contactPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={40}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+44 20 7946 0958"
                  aria-invalid={fieldErrors.contactPhone ? true : undefined}
                  aria-describedby={fieldErrors.contactPhone ? phoneErrorId : undefined}
                />
                {fieldErrors.contactPhone ? (
                  <p id={phoneErrorId} className="text-xs text-error">
                    {fieldErrors.contactPhone}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${formId}-message`}>Message (optional)</Label>
                <Textarea
                  id={`${formId}-message`}
                  name="message"
                  rows={6}
                  maxLength={ENQUIRY_MESSAGE_MAX_LENGTH}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Ask about framing, provenance, viewing, or delivery."
                  aria-invalid={fieldErrors.message ? true : undefined}
                  aria-describedby={
                    fieldErrors.message ? `${messageErrorId} ${messageCountId}` : messageCountId
                  }
                />
                <div className="flex justify-between gap-3 text-xs text-on-surface-variant">
                  {fieldErrors.message ? (
                    <p id={messageErrorId} className="text-error">
                      {fieldErrors.message}
                    </p>
                  ) : (
                    <span />
                  )}
                  <p id={messageCountId}>
                    {message.length}/{ENQUIRY_MESSAGE_MAX_LENGTH}
                  </p>
                </div>
              </div>
            </form>
          )}
        </div>
      </MarketingSideSheet>
    </>
  );
}
