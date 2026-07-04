"use client";

import { PushSubscriptionCard } from "@/components/dashboard/push-subscription-card";
import {
  type NotificationPreferencesFormValues,
  buildNotificationPreset,
} from "@/lib/notifications/notification-preferences-registry";
import { Button } from "@auction/ui/components/button";
import { LabelCaps } from "@auction/ui/components/typography";
import type { useForm } from "react-hook-form";
import { PreferencesMatrix } from "./preferences-matrix";

export function DeliveryChannelsSection({
  form,
  saveDisabled,
}: {
  form: ReturnType<typeof useForm<NotificationPreferencesFormValues>>;
  saveDisabled: boolean;
}) {
  return (
    <section className="space-y-3">
      <div>
        <LabelCaps>Delivery channels</LabelCaps>
        <p className="mt-2 font-body text-sm text-on-surface-variant">
          Choose how each alert reaches you. WhatsApp is visible here so the setting is ready when
          delivery launches.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            form.reset({ ...form.getValues(), ...buildNotificationPreset("essential") })
          }
        >
          Essential only
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            form.reset({ ...form.getValues(), ...buildNotificationPreset("activeBidder") })
          }
        >
          Active bidder
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => form.reset({ ...form.getValues(), ...buildNotificationPreset("quiet") })}
        >
          Pause optional alerts
        </Button>
      </div>
      <PreferencesMatrix form={form} />
      <PushSubscriptionCard saveDisabled={saveDisabled} />
    </section>
  );
}
