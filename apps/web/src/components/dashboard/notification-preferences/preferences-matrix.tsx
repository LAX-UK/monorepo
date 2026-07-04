"use client";

import {
  NOTIFICATION_PREFERENCE_CHANNELS,
  NOTIFICATION_PREFERENCE_EVENTS,
  type NotificationPreferencesFormValues,
} from "@/lib/notifications/notification-preferences-registry";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@auction/ui/components/accordion";
import { Surface } from "@auction/ui/components/surface";
import { LabelCaps } from "@auction/ui/components/typography";
import type { useForm } from "react-hook-form";
import { PreferenceCell } from "./preference-cell";

export function PreferencesMatrix({
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
              {NOTIFICATION_PREFERENCE_CHANNELS.map((channel) => (
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
            {NOTIFICATION_PREFERENCE_EVENTS.map((event) => (
              <tr key={event.id} className="border-b border-border-hairline last:border-0">
                <th scope="row" className="px-5 py-4 text-left align-middle">
                  <div className="font-body text-sm font-medium text-on-surface">{event.label}</div>
                  <p className="mt-1 font-body text-xs leading-5 text-on-surface-variant">
                    {event.description}
                  </p>
                </th>
                {NOTIFICATION_PREFERENCE_CHANNELS.map((channel) => (
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
        {NOTIFICATION_PREFERENCE_EVENTS.map((event) => (
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
                {NOTIFICATION_PREFERENCE_CHANNELS.map((channel) => (
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
