"use client";

import { PushSubscriptionCard } from "@/components/dashboard/push-subscription-card";
import { RhfTimePicker } from "@/components/ui/rhf-time-picker";
import { updateNotificationPreferencesFromValuesAction } from "@/lib/actions/user-notification-preferences";
import { notify } from "@/lib/ui/notify";
import type { NotificationPreference } from "@auction/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@auction/ui/components/accordion";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { Surface } from "@auction/ui/components/surface";
import { Switch } from "@auction/ui/components/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@auction/ui/components/tooltip";
import { LabelCaps } from "@auction/ui/components/typography";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { z } from "zod";

const WHATSAPP_UI_ENABLED = false;

const notificationPreferencesFormSchema = z.object({
  outbidInApp: z.boolean(),
  wonInApp: z.boolean(),
  lostInApp: z.boolean(),
  endingSoonInApp: z.boolean(),
  watchlistInApp: z.boolean(),
  paymentInApp: z.boolean(),
  outbidPush: z.boolean(),
  wonPush: z.boolean(),
  endingSoonPush: z.boolean(),
  outbidEmail: z.boolean(),
  wonEmail: z.boolean(),
  lostEmail: z.boolean(),
  endingSoonEmail: z.boolean(),
  watchlistEmail: z.boolean(),
  paymentEmail: z.boolean(),
  lotEndedSellerEmail: z.boolean(),
  submissionUpdatesEmail: z.boolean(),
  submissionUpdatesPush: z.boolean(),
  outbidWhatsapp: z.boolean(),
  wonWhatsapp: z.boolean(),
  lostWhatsapp: z.boolean(),
  endingSoonWhatsapp: z.boolean(),
  watchlistWhatsapp: z.boolean(),
  paymentWhatsapp: z.boolean(),
  lotEndedSellerWhatsapp: z.boolean(),
  quietStart: z.string(),
  quietEnd: z.string(),
});

type NotificationPreferencesFormValues = z.infer<typeof notificationPreferencesFormSchema>;

type BooleanNotificationFieldName = Exclude<
  keyof NotificationPreferencesFormValues,
  "quietStart" | "quietEnd"
>;

type EventDescriptor = {
  id: string;
  label: string;
  description: string;
  fields: Partial<Record<ChannelId, BooleanNotificationFieldName>>;
};

type ChannelId = "inApp" | "push" | "email" | "whatsapp";

type ChannelDescriptor = {
  id: ChannelId;
  label: string;
  Icon: typeof Bell;
};

const channels: ChannelDescriptor[] = [
  { id: "inApp", label: "In-app", Icon: Bell },
  { id: "push", label: "Push", Icon: Smartphone },
  { id: "email", label: "Email", Icon: Mail },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

const events: EventDescriptor[] = [
  {
    id: "outbid",
    label: "Outbid",
    description: "When another bidder exceeds your current bid.",
    fields: {
      inApp: "outbidInApp",
      push: "outbidPush",
      email: "outbidEmail",
      whatsapp: "outbidWhatsapp",
    },
  },
  {
    id: "won",
    label: "Won auctions",
    description: "When you win a lot and need to complete the next steps.",
    fields: {
      inApp: "wonInApp",
      push: "wonPush",
      email: "wonEmail",
      whatsapp: "wonWhatsapp",
    },
  },
  {
    id: "lost",
    label: "Lost auctions",
    description: "When an auction you followed closes without you winning.",
    fields: {
      inApp: "lostInApp",
      email: "lostEmail",
      whatsapp: "lostWhatsapp",
    },
  },
  {
    id: "endingSoon",
    label: "Ending soon",
    description: "When watched lots or active bids are close to closing.",
    fields: {
      inApp: "endingSoonInApp",
      push: "endingSoonPush",
      email: "endingSoonEmail",
      whatsapp: "endingSoonWhatsapp",
    },
  },
  {
    id: "watchlist",
    label: "Watchlist",
    description: "When watched lots start or receive important activity.",
    fields: {
      inApp: "watchlistInApp",
      email: "watchlistEmail",
      whatsapp: "watchlistWhatsapp",
    },
  },
  {
    id: "payment",
    label: "Payments",
    description: "Receipts, invoices, and payment due reminders.",
    fields: {
      inApp: "paymentInApp",
      email: "paymentEmail",
      whatsapp: "paymentWhatsapp",
    },
  },
  {
    id: "sellerEnded",
    label: "Lot ended (seller)",
    description: "Seller updates when one of your listed lots closes.",
    fields: {
      email: "lotEndedSellerEmail",
      whatsapp: "lotEndedSellerWhatsapp",
    },
  },
  {
    id: "submissionUpdates",
    label: "Consignment updates",
    description:
      "When your submission is accepted, converted to a draft lot, not accepted, or needs a draft reminder.",
    fields: {
      email: "submissionUpdatesEmail",
      push: "submissionUpdatesPush",
    },
  },
];

function prefsToFormValues(prefs: NotificationPreference): NotificationPreferencesFormValues {
  return {
    outbidInApp: prefs.outbidInApp,
    wonInApp: prefs.wonInApp,
    lostInApp: prefs.lostInApp,
    endingSoonInApp: prefs.endingSoonInApp,
    watchlistInApp: prefs.watchlistInApp,
    paymentInApp: prefs.paymentInApp,
    outbidPush: prefs.outbidPush,
    wonPush: prefs.wonPush,
    endingSoonPush: prefs.endingSoonPush,
    outbidEmail: prefs.outbidEmail,
    wonEmail: prefs.wonEmail,
    lostEmail: prefs.lostEmail,
    endingSoonEmail: prefs.endingSoonEmail,
    watchlistEmail: prefs.watchlistEmail,
    paymentEmail: prefs.paymentEmail,
    lotEndedSellerEmail: prefs.lotEndedSellerEmail,
    submissionUpdatesEmail: prefs.submissionUpdatesEmail,
    submissionUpdatesPush: prefs.submissionUpdatesPush,
    outbidWhatsapp: prefs.outbidWhatsapp,
    wonWhatsapp: prefs.wonWhatsapp,
    lostWhatsapp: prefs.lostWhatsapp,
    endingSoonWhatsapp: prefs.endingSoonWhatsapp,
    watchlistWhatsapp: prefs.watchlistWhatsapp,
    paymentWhatsapp: prefs.paymentWhatsapp,
    lotEndedSellerWhatsapp: prefs.lotEndedSellerWhatsapp,
    quietStart: prefs.quietStart ?? "",
    quietEnd: prefs.quietEnd ?? "",
  };
}

function formValuesToPatch(values: NotificationPreferencesFormValues) {
  return {
    ...values,
    quietStart: values.quietStart.trim() === "" ? null : values.quietStart.trim(),
    quietEnd: values.quietEnd.trim() === "" ? null : values.quietEnd.trim(),
  };
}

function buildPreset(
  mode: "essential" | "activeBidder" | "quiet",
): Partial<NotificationPreferencesFormValues> {
  const enabled = mode !== "quiet";
  return {
    outbidInApp: enabled,
    wonInApp: enabled,
    lostInApp: mode === "activeBidder",
    endingSoonInApp: mode === "activeBidder",
    watchlistInApp: mode === "activeBidder",
    paymentInApp: enabled,
    outbidPush: mode === "activeBidder",
    wonPush: mode === "activeBidder",
    endingSoonPush: mode === "activeBidder",
    outbidEmail: mode === "activeBidder",
    wonEmail: enabled,
    lostEmail: mode === "activeBidder",
    endingSoonEmail: mode === "activeBidder",
    watchlistEmail: mode === "activeBidder",
    paymentEmail: enabled,
    lotEndedSellerEmail: enabled,
    submissionUpdatesEmail: enabled,
    submissionUpdatesPush: enabled,
  };
}

export function NotificationPreferencesForm({
  initial,
}: { initial: NotificationPreference | null }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<NotificationPreferencesFormValues>({
    resolver: zodResolver(notificationPreferencesFormSchema),
    defaultValues: initial
      ? prefsToFormValues(initial)
      : {
          outbidInApp: true,
          wonInApp: true,
          lostInApp: true,
          endingSoonInApp: true,
          watchlistInApp: true,
          paymentInApp: true,
          outbidPush: false,
          wonPush: false,
          endingSoonPush: false,
          outbidEmail: false,
          wonEmail: true,
          lostEmail: true,
          endingSoonEmail: true,
          watchlistEmail: false,
          paymentEmail: true,
          lotEndedSellerEmail: true,
          outbidWhatsapp: false,
          wonWhatsapp: false,
          lostWhatsapp: false,
          endingSoonWhatsapp: false,
          watchlistWhatsapp: false,
          paymentWhatsapp: false,
          lotEndedSellerWhatsapp: false,
          quietStart: "",
          quietEnd: "",
        },
  });

  useEffect(() => {
    if (initial) {
      form.reset(prefsToFormValues(initial));
    }
  }, [form, initial]);

  if (!initial) {
    return null;
  }

  return (
    <Form {...form}>
      <form
        className="space-y-8"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          startTransition(() => {
            void (async () => {
              const r = await updateNotificationPreferencesFromValuesAction(
                formValuesToPatch(values),
              );
              if (r.ok) {
                notify.success("Preferences saved");
                router.replace("/dashboard/settings/notifications?saved=1");
                router.refresh();
                return;
              }
              if (r.fieldErrors) {
                for (const [key, msgs] of Object.entries(r.fieldErrors)) {
                  if (msgs?.[0]) {
                    form.setError(key as FieldPath<NotificationPreferencesFormValues>, {
                      message: msgs[0],
                    });
                  }
                }
              } else {
                notify.error(r.error);
              }
            })();
          });
        })}
      >
        <section className="space-y-3">
          <div>
            <LabelCaps>Delivery channels</LabelCaps>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              Choose how each alert reaches you. WhatsApp is visible here so the setting is ready
              when delivery launches.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset({ ...form.getValues(), ...buildPreset("essential") })}
            >
              Essential only
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset({ ...form.getValues(), ...buildPreset("activeBidder") })}
            >
              Active bidder
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset({ ...form.getValues(), ...buildPreset("quiet") })}
            >
              Pause optional alerts
            </Button>
          </div>
          <PreferencesMatrix form={form} />
          <PushSubscriptionCard saveDisabled={pending} />
        </section>

        <section>
          <h2 className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Quiet hours (UTC)
          </h2>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            Quiet hours apply to push and WhatsApp. Email and in-app notifications can still be
            delivered. Times below are in UTC.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <FormField
              control={form.control}
              name="quietStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body text-sm">Start</FormLabel>
                  <RhfTimePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className="mt-1 block min-w-36 font-body text-sm"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="quietEnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body text-sm">End</FormLabel>
                  <RhfTimePicker
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className="mt-1 block min-w-36 font-body text-sm"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <LoadingButton
          type="submit"
          className="min-h-11 w-full sm:w-auto"
          loading={pending}
          loadingLabel="Saving…"
        >
          Save preferences
        </LoadingButton>
      </form>
    </Form>
  );
}

function PreferencesMatrix({
  form,
}: {
  form: ReturnType<typeof useForm<NotificationPreferencesFormValues>>;
}) {
  return (
    <Surface variant="inset" padding="none" className="overflow-hidden shadow-none">
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[640px] table-fixed" aria-label="Notification preferences">
          <thead>
            <tr className="border-b border-border-hairline">
              <th scope="col" className="w-[44%] px-5 py-3 text-left">
                <LabelCaps>Event</LabelCaps>
              </th>
              {channels.map((channel) => (
                <th key={channel.id} scope="col" className="px-2 py-3">
                  <div className="flex flex-col items-center gap-1 text-on-surface-variant">
                    <channel.Icon className="size-4" aria-hidden />
                    <LabelCaps className="tracking-[0.18em]">{channel.label}</LabelCaps>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-border-hairline last:border-0">
                <th scope="row" className="px-5 py-4 text-left align-middle">
                  <div className="font-body text-sm font-medium text-on-surface">{event.label}</div>
                  <p className="mt-1 font-body text-xs leading-5 text-on-surface-variant">
                    {event.description}
                  </p>
                </th>
                {channels.map((channel) => (
                  <td key={channel.id} className="px-2 py-4 text-center align-middle">
                    <PreferenceCell form={form} event={event} channel={channel} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Accordion type="multiple" className="lg:hidden">
        {events.map((event) => (
          <AccordionItem key={event.id} value={event.id} className="border-border-hairline px-4">
            <AccordionTrigger className="hover:no-underline">
              <span>
                <span className="block font-body text-sm font-medium text-on-surface">
                  {event.label}
                </span>
                <span className="mt-1 block font-body text-xs font-normal text-on-surface-variant">
                  {event.description}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {channels.map((channel) => (
                  <div key={channel.id} className="flex items-center justify-between gap-4 py-1">
                    <div className="flex items-center gap-2 font-body text-sm text-on-surface">
                      <channel.Icon className="size-4 text-on-surface-variant" aria-hidden />
                      {channel.label}
                    </div>
                    <PreferenceCell form={form} event={event} channel={channel} />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Surface>
  );
}

function PreferenceCell({
  form,
  event,
  channel,
}: {
  form: ReturnType<typeof useForm<NotificationPreferencesFormValues>>;
  event: EventDescriptor;
  channel: ChannelDescriptor;
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
