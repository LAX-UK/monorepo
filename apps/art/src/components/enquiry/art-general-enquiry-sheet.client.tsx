"use client";

import { ArtEnquiryConfirmation } from "@/components/enquiry/art-enquiry-confirmation";
import { ArtEnquiryForm } from "@/components/enquiry/art-enquiry-form.client";
import type { ArtEnquiryContact } from "@/lib/artwork/artwork-detail-page.composer";
import { sendArtGeneralEnquiry } from "@/lib/enquiry/art-general-enquiry-actions.server";
import { buildEnquiryConfirmation } from "@/lib/enquiry/enquiry-confirmation.vm";
import {
  ART_GENERAL_ENQUIRY_TOPICS,
  type ArtGeneralEnquiryState,
  type ArtGeneralEnquiryTopic,
} from "@/lib/enquiry/submit-general-enquiry";
import { MarketingSideSheet } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Alert, AlertDescription } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { type ReactNode, useActionState, useEffect, useId, useMemo, useRef, useState } from "react";

const INITIAL: ArtGeneralEnquiryState = { status: "idle" };
const MESSAGE_MAX_LENGTH = 4000;

type Props = {
  autoOpen?: boolean;
  defaultTopic?: ArtGeneralEnquiryTopic;
  contextSlug?: string | null;
  contextLabel?: string | null;
  /** Prefill for signed-in visitors; guests start empty. */
  /** Signed-in visitors are offered their Enquiries after sending; guests an account. */
  viewerKind: "authenticated" | "guest";
  contact: ArtEnquiryContact;
  triggerLabel?: string;
  /** The trigger button style; a page's one primary action keeps the default. */
  triggerVariant?: "default" | "secondaryOutline";
  /** Extra trigger classes, e.g. full width beside the primary action. */
  triggerClassName?: string;
  /** Replaces the default button, e.g. with the header's text-sized "Enquire" control. */
  renderTrigger?: (open: () => void) => ReactNode;
};

/** Figma 614:12257 (desktop panel), 533:9469 (mobile sheet), 616:12737 (sent). */
export function ArtGeneralEnquirySheet({
  autoOpen = false,
  defaultTopic = "general",
  contextSlug = null,
  contextLabel = null,
  contact,
  triggerLabel = "Send a message",
  triggerVariant = "default",
  triggerClassName,
  viewerKind,
  renderTrigger,
}: Props) {
  const [open, setOpen] = useState(autoOpen);
  const [topic, setTopic] = useState<ArtGeneralEnquiryTopic>(defaultTopic);
  const action = useMemo(() => sendArtGeneralEnquiry.bind(null, contextSlug), [contextSlug]);
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const topicId = useId();
  const sentRef = useRef<HTMLOutputElement>(null);
  const sent = state.status === "sent";

  useEffect(() => {
    if (sent) sentRef.current?.focus();
  }, [sent]);

  const topicError = state.status === "invalid" ? state.fieldErrors.topic : undefined;

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <Button
          type="button"
          size="lg"
          variant={triggerVariant}
          className={cn("min-h-11 w-fit font-label", triggerClassName)}
          onClick={() => setOpen(true)}
          data-testid="art-general-enquire-trigger"
        >
          {triggerLabel}
        </Button>
      )}
      <MarketingSideSheet
        open={open}
        onOpenChange={setOpen}
        title="Send an enquiry"
        titleCase="sentence"
      >
        {state.status === "sent" ? (
          <div data-testid="art-general-enquire-sent">
            <ArtEnquiryConfirmation
              ref={sentRef}
              vm={buildEnquiryConfirmation({ viewer: { kind: viewerKind }, subject: topic })}
              email={state.email}
              onClose={() => setOpen(false)}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <p className="text-base leading-6 text-on-surface">
              {contextLabel
                ? `Tell us what you would like to know about ${contextLabel}. The gallery team replies within one working day.`
                : "Tell us what you would like to know. The gallery team replies within one working day."}
            </p>
            <ArtEnquiryForm
              action={formAction}
              pending={pending}
              contact={contact}
              serverErrors={state.status === "invalid" ? state.fieldErrors : {}}
              messageRequired
              messageMaxLength={MESSAGE_MAX_LENGTH}
              leading={
                <div className="flex flex-col gap-1">
                  <Label htmlFor={topicId} className="text-sm font-normal text-on-surface-variant">
                    Topic
                  </Label>
                  <Select
                    name="topic"
                    value={topic}
                    onValueChange={(value) => setTopic(value as ArtGeneralEnquiryTopic)}
                  >
                    <SelectTrigger
                      id={topicId}
                      variant="underline"
                      className="min-h-11"
                      aria-invalid={topicError ? true : undefined}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ART_GENERAL_ENQUIRY_TOPICS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {topicError ? <p className="text-xs text-error">{topicError}</p> : null}
                </div>
              }
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
      </MarketingSideSheet>
    </>
  );
}
