import { staffFieldId } from "@/components/admin/forms/staff-form-fields";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { Field, TextInput } from "@auction/staff-ui";
import type { RefObject } from "react";
import { type UseFormReturn, useController } from "react-hook-form";
import { SALE_FORM_ID } from "../../sale-form-id";
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
  const { field, fieldState } = useController({ control: form.control, name: "streamUrl" });
  return (
    <Field
      id={staffFieldId(SALE_FORM_ID, "streamUrl")}
      label="Live stream link"
      optional
      disabled={!streamFieldEnabled}
      description="The saleroom broadcast on the sale and lot pages during the auction. YouTube, Vimeo (including live event links), Twitch or Cloudflare Stream."
      error={fieldState.error?.message}
    >
      <TextInput
        ref={field.ref}
        name={field.name}
        value={field.value ?? ""}
        placeholder="https://vimeo.com/event/…"
        disabled={!streamFieldEnabled}
        onChange={(event) => field.onChange(event.target.value)}
        onBlur={() => {
          field.onBlur();
          streamBlurRef.current?.();
        }}
      />
      {streamFieldEnabled ? (
        <StreamUrlVerifyControl
          value={field.value}
          initialValue={initialStreamUrl}
          disabled={!streamFieldEnabled}
          {...(streamUrlGateRef ? { gateRef: streamUrlGateRef } : {})}
          blurHandlerRef={streamBlurRef}
        />
      ) : null}
    </Field>
  );
}
