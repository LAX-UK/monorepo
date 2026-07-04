import type { NotificationPreference } from "@auction/types";
import { Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import { z } from "zod";

export const WHATSAPP_UI_ENABLED = false;

export const notificationPreferencesFormSchema = z.object({
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

export type NotificationPreferencesFormValues = z.infer<typeof notificationPreferencesFormSchema>;

export type BooleanNotificationFieldName = Exclude<
  keyof NotificationPreferencesFormValues,
  "quietStart" | "quietEnd"
>;

export type NotificationChannelId = "inApp" | "push" | "email" | "whatsapp";

export type NotificationEventDescriptor = {
  id: string;
  label: string;
  description: string;
  fields: Partial<Record<NotificationChannelId, BooleanNotificationFieldName>>;
};

export type NotificationChannelDescriptor = {
  id: NotificationChannelId;
  label: string;
  Icon: typeof Bell;
};

export const NOTIFICATION_PREFERENCE_CHANNELS: NotificationChannelDescriptor[] = [
  { id: "inApp", label: "In-app", Icon: Bell },
  { id: "push", label: "Push", Icon: Smartphone },
  { id: "email", label: "Email", Icon: Mail },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
];

export const NOTIFICATION_PREFERENCE_EVENTS: NotificationEventDescriptor[] = [
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
      "When your submission is accepted, converted to a catalogue entry, not accepted, or needs a submission reminder.",
    fields: {
      email: "submissionUpdatesEmail",
      push: "submissionUpdatesPush",
    },
  },
];

export function prefsToFormValues(
  prefs: NotificationPreference,
): NotificationPreferencesFormValues {
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

export function formValuesToPatch(values: NotificationPreferencesFormValues) {
  return {
    ...values,
    quietStart: values.quietStart.trim() === "" ? null : values.quietStart.trim(),
    quietEnd: values.quietEnd.trim() === "" ? null : values.quietEnd.trim(),
  };
}

export function buildNotificationPreset(
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

export const DEFAULT_NOTIFICATION_PREFERENCES_FORM_VALUES: NotificationPreferencesFormValues = {
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
  submissionUpdatesEmail: true,
  submissionUpdatesPush: true,
  quietStart: "",
  quietEnd: "",
};
