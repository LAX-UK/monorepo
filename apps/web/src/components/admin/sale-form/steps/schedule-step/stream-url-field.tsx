import { UnderlineInput } from "@/components/ui/input";
import { LabelCaps } from "@/components/ui/typography";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import type { RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  type StreamUrlVerificationGate,
  StreamUrlVerifyControl,
} from "../../stream-url-verify-control";

type Props = {
  form: UseFormReturn<AdminSaleFormValues>;
  streamFieldEnabled: boolean;
  initialStreamUrl: string;
  streamUrlGateRef?: RefObject<StreamUrlVerificationGate | null>;
  streamBlurRef: RefObject<(() => void) | null>;
};

export function StreamUrlField({
  form,
  streamFieldEnabled,
  initialStreamUrl,
  streamUrlGateRef,
  streamBlurRef,
}: Props) {
  return (
    <FormField
      control={form.control}
      name="streamUrl"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="mb-2 block">
            <LabelCaps>Live stream URL (optional)</LabelCaps>
          </FormLabel>
          <FormControl>
            <UnderlineInput
              id="streamUrl"
              placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/event/…"
              disabled={!streamFieldEnabled}
              {...field}
              onBlur={() => {
                field.onBlur();
                streamBlurRef.current?.();
              }}
            />
          </FormControl>
          <p className="mt-2 font-body text-xs text-on-surface-variant">
            Live venue broadcast shown on lot pages and the sale overview during the auction.
            Allowed: YouTube, Vimeo (including live event links), Twitch, Cloudflare Stream.
          </p>
          {streamFieldEnabled ? (
            <StreamUrlVerifyControl
              value={field.value}
              initialValue={initialStreamUrl}
              disabled={!streamFieldEnabled}
              {...(streamUrlGateRef ? { gateRef: streamUrlGateRef } : {})}
              blurHandlerRef={streamBlurRef}
            />
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
