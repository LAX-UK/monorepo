"use client";

import { ArtAuthLink } from "@/components/art-auth-link";
import { sendArtGeneralEnquiry } from "@/lib/enquiry/art-general-enquiry-actions.server";
import {
  ART_GENERAL_ENQUIRY_TOPICS,
  type ArtGeneralEnquiryState,
  type ArtGeneralEnquiryTopic,
} from "@/lib/enquiry/submit-general-enquiry";
import { MarketingSideSheet } from "@auction/marketing-ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Textarea } from "@auction/ui/components/textarea";
import { useActionState, useId, useMemo, useState } from "react";

const INITIAL: ArtGeneralEnquiryState = { status: "idle" };

type Props = {
  autoOpen?: boolean;
  defaultTopic?: ArtGeneralEnquiryTopic;
  contextSlug?: string | null;
  contextLabel?: string | null;
  loginHref: string;
  triggerLabel?: string;
};

export function ArtGeneralEnquirySheet({
  autoOpen = false,
  defaultTopic = "general",
  contextSlug = null,
  contextLabel = null,
  loginHref,
  triggerLabel = "Send a message",
}: Props) {
  const [open, setOpen] = useState(autoOpen);
  const [topic, setTopic] = useState<ArtGeneralEnquiryTopic>(defaultTopic);
  const action = useMemo(() => sendArtGeneralEnquiry.bind(null, contextSlug), [contextSlug]);
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const formId = useId();

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="min-h-11 w-fit font-label uppercase"
        onClick={() => setOpen(true)}
        data-testid="art-general-enquire-trigger"
      >
        {triggerLabel}
      </Button>
      <MarketingSideSheet
        open={open}
        onOpenChange={setOpen}
        title="Contact the gallery"
        description={
          contextLabel
            ? `About ${contextLabel}. We typically respond within one business day.`
            : "We typically respond within one business day."
        }
      >
        {state.status === "sent" ? (
          <Alert data-testid="art-general-enquire-sent">
            <AlertTitle>Message sent</AlertTitle>
            <AlertDescription>
              Thank you — the gallery team will be in touch. You can follow up from Enquiries in
              your account.
            </AlertDescription>
          </Alert>
        ) : (
          <form action={formAction} className="flex flex-col gap-4" id={formId} noValidate>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${formId}-topic`}>Topic</Label>
              <Select
                name="topic"
                value={topic}
                onValueChange={(value) => setTopic(value as ArtGeneralEnquiryTopic)}
              >
                <SelectTrigger id={`${formId}-topic`} className="min-h-11">
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${formId}-message`}>Message</Label>
              <Textarea
                id={`${formId}-message`}
                name="message"
                required
                maxLength={4000}
                rows={6}
                className="min-h-32"
                aria-invalid={state.status === "invalid" ? true : undefined}
                aria-describedby={state.status === "invalid" ? `${formId}-error` : undefined}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${formId}-phone`}>Phone (optional)</Label>
              <Input
                id={`${formId}-phone`}
                name="contactPhone"
                type="tel"
                autoComplete="tel"
                maxLength={40}
              />
            </div>
            {state.status === "invalid" || state.status === "error" ? (
              <Alert variant="destructive" id={`${formId}-error`} role="alert">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}
            {state.status === "sign_in_required" ? (
              <Alert variant="warning" role="alert">
                <AlertDescription>
                  Your session has ended.{" "}
                  <ArtAuthLink href={loginHref} className="underline underline-offset-4">
                    Sign in again
                  </ArtAuthLink>{" "}
                  to send your message.
                </AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="min-h-11 font-label uppercase"
              disabled={pending}
            >
              {pending ? "Sending…" : "Send enquiry"}
            </Button>
          </form>
        )}
      </MarketingSideSheet>
    </>
  );
}
