"use client";

import { updateNotificationPreferencesFromValuesAction } from "@/lib/actions/user-notification-preferences";
import {
  DEFAULT_NOTIFICATION_PREFERENCES_FORM_VALUES,
  type NotificationPreferencesFormValues,
  formValuesToPatch,
  notificationPreferencesFormSchema,
  prefsToFormValues,
} from "@/lib/notifications/notification-preferences-registry";
import { notify } from "@/lib/ui/notify";
import type { NotificationPreference } from "@auction/types";
import { Form } from "@auction/ui/components/form";
import { LoadingButton } from "@auction/ui/components/loading-button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";
import { DeliveryChannelsSection } from "./notification-preferences/delivery-channels-section";
import { QuietHoursSection } from "./notification-preferences/quiet-hours-section";

export function NotificationPreferencesForm({
  initial,
}: { initial: NotificationPreference | null }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<NotificationPreferencesFormValues>({
    resolver: zodResolver(notificationPreferencesFormSchema),
    defaultValues: initial
      ? prefsToFormValues(initial)
      : DEFAULT_NOTIFICATION_PREFERENCES_FORM_VALUES,
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
        <DeliveryChannelsSection form={form} saveDisabled={pending} />
        <QuietHoursSection form={form} />
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
