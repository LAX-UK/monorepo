import { SITE_NAME } from "./site.js";

/** Centralised transactional email subjects (templates should import from here). */
export const emailSubjects = {
  passwordChanged: `Your ${SITE_NAME} password was changed`,
  twoFactorEnabled: `Two-factor authentication was turned on — ${SITE_NAME}`,
  twoFactorDisabled: `Two-factor authentication was turned off — ${SITE_NAME}`,
  socialAccountLinked: `A sign-in method was linked to your ${SITE_NAME} account`,
  socialAccountUnlinked: `A sign-in method was disconnected from your ${SITE_NAME} account`,
  newDeviceLogin: `New sign-in to your ${SITE_NAME} account`,
  passwordChangedElsewhere: `Your ${SITE_NAME} password was reset from another session`,
  passwordChangedSessionsNotRevoked: `Action needed: review active ${SITE_NAME} sessions`,
  kycResubmissionRequired: `Action needed on your ${SITE_NAME} identity verification`,
  submissionApproved: `Your ${SITE_NAME} submission was accepted`,
  submissionConverted: `Draft lot created for your ${SITE_NAME} submission`,
  submissionRejected: `Update on your ${SITE_NAME} submission`,
  submissionDraftReminder: `Reminder: finish your ${SITE_NAME} submission`,
} as const;
