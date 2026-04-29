"use client";

import { NotificationPushEnableButton } from "@/components/dashboard/notification-push-enable-button";
import { updateNotificationPreferencesFromValuesAction } from "@/lib/actions/user-notification-preferences";
import type { NotificationPreference } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { Switch } from "@auction/ui/components/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { type ControllerRenderProps, type FieldPath, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
  quietStart: z.string(),
  quietEnd: z.string(),
});

type NotificationPreferencesFormValues = z.infer<typeof notificationPreferencesFormSchema>;

type BooleanNotificationFieldName = Exclude<
  keyof NotificationPreferencesFormValues,
  "quietStart" | "quietEnd"
>;

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

function rowSwitchField(
  label: string,
  field: ControllerRenderProps<NotificationPreferencesFormValues, BooleanNotificationFieldName>,
) {
  return (
    <FormItem className="space-y-0">
      <div className="flex items-center justify-between gap-4 border-b border-outline-variant/10 py-3">
        <div className="min-w-0">
          <FormLabel
            htmlFor={field.name}
            className="cursor-pointer font-body text-sm font-normal text-on-surface"
          >
            {label}
          </FormLabel>
        </div>
        <FormControl>
          <Switch
            ref={field.ref}
            id={field.name}
            checked={field.value}
            onCheckedChange={(v) => field.onChange(v === true)}
            onBlur={field.onBlur}
          />
        </FormControl>
      </div>
      <FormMessage />
    </FormItem>
  );
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
                toast.success("Preferences saved");
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
                toast.error(r.error);
              }
            })();
          });
        })}
      >
        <section>
          <h2 className="font-label text-xs uppercase tracking-widest text-secondary">In-app</h2>
          <div className="mt-1">
            <FormField
              control={form.control}
              name="outbidInApp"
              render={({ field }) => rowSwitchField("Outbid", field)}
            />
            <FormField
              control={form.control}
              name="wonInApp"
              render={({ field }) => rowSwitchField("Won auctions", field)}
            />
            <FormField
              control={form.control}
              name="lostInApp"
              render={({ field }) => rowSwitchField("Lost auctions", field)}
            />
            <FormField
              control={form.control}
              name="endingSoonInApp"
              render={({ field }) => rowSwitchField("Ending soon", field)}
            />
            <FormField
              control={form.control}
              name="watchlistInApp"
              render={({ field }) => rowSwitchField("Watchlist", field)}
            />
            <FormField
              control={form.control}
              name="paymentInApp"
              render={({ field }) => rowSwitchField("Payments", field)}
            />
          </div>
        </section>

        <section>
          <h2 className="font-label text-xs uppercase tracking-widest text-secondary">Push</h2>
          <div className="mt-1">
            <FormField
              control={form.control}
              name="outbidPush"
              render={({ field }) => rowSwitchField("Outbid (push)", field)}
            />
            <FormField
              control={form.control}
              name="wonPush"
              render={({ field }) => rowSwitchField("Won (push)", field)}
            />
            <FormField
              control={form.control}
              name="endingSoonPush"
              render={({ field }) => rowSwitchField("Ending soon (push)", field)}
            />
            <NotificationPushEnableButton saveDisabled={pending} />
          </div>
        </section>

        <section>
          <h2 className="font-label text-xs uppercase tracking-widest text-secondary">
            Quiet hours (UTC, push)
          </h2>
          <div className="mt-2 flex flex-wrap gap-3">
            <FormField
              control={form.control}
              name="quietStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-body text-sm">Start</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      className="mt-1 block min-h-11 min-w-36 font-body text-sm"
                      {...field}
                    />
                  </FormControl>
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
                  <FormControl>
                    <Input
                      type="time"
                      className="mt-1 block min-h-11 min-w-36 font-body text-sm"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </section>

        <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
      </form>
    </Form>
  );
}
