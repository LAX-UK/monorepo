"use client";

import {
  type NotificationChannelDescriptor,
  type NotificationEventDescriptor,
  type NotificationPreferencesFormValues,
  WHATSAPP_UI_ENABLED,
} from "@/lib/notifications/notification-preferences-registry";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Switch } from "@auction/ui/components/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import type { FieldPath, useForm } from "react-hook-form";

export function PreferenceCell({
  form,
  event,
  channel,
}: {
  form: ReturnType<typeof useForm<NotificationPreferencesFormValues>>;
  event: NotificationEventDescriptor;
  channel: NotificationChannelDescriptor;
}) {
  const fieldName = event.fields[channel.id];
  if (!fieldName) return <span className="text-on-surface-variant">—</span>;
  const disabled = channel.id === "whatsapp" && !WHATSAPP_UI_ENABLED;
  const tooltip =
    channel.id === "whatsapp" && !WHATSAPP_UI_ENABLED
      ? "Coming soon — WhatsApp delivery launches with the WhatsApp Business integration."
      : null;

  const field = (
    <FormField
      control={form.control}
      name={fieldName as FieldPath<NotificationPreferencesFormValues>}
      render={({ field }) => (
        <FormItem className="space-y-0">
          <FormLabel className="sr-only">
            {event.label} via {channel.label}
          </FormLabel>
          <FormControl>
            <Switch
              ref={field.ref}
              checked={field.value === true}
              disabled={disabled}
              aria-label={`${event.label} via ${channel.label}`}
              onCheckedChange={(v) => field.onChange(v === true)}
              onBlur={field.onBlur}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return tooltip ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{field}</span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  ) : (
    field
  );
}
