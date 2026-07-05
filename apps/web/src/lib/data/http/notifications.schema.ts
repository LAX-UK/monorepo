import {
  parseNotificationPreference,
  parseUserNotification,
} from "@/lib/data/http/parse/notifications.parse";
import { zTransformParse } from "@/lib/data/http/schema-coerce";
import type { NotificationPreference, UserNotification } from "@auction/types";

/** Row schema for `GET /users/me/notifications` list envelopes. */
export const userNotificationSchema = zTransformParse<UserNotification>(parseUserNotification);

/** Row schema for `GET /users/me/preferences/notifications`. */
export const notificationPreferenceSchema = zTransformParse<NotificationPreference>(
  parseNotificationPreference,
);
