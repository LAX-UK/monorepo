"use client";

import { RhfTimePicker } from "@/components/ui/rhf-time-picker";
import type { NotificationPreferencesFormValues } from "@/lib/notifications/notification-preferences-registry";
import { FormField, FormItem, FormLabel, FormMessage } from "@auction/ui/components/form";
import type { useForm } from "react-hook-form";

export function QuietHoursSection({
  form,
}: {
  form: ReturnType<typeof useForm<NotificationPreferencesFormValues>>;
}) {
  return (
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
  );
}
