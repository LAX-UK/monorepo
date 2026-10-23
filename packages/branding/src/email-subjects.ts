import { SITE_NAME } from "./site.js";

/** Centralised transactional email subjects (templates should import from here). */
export const emailSubjects = {
  passwordChanged: "Your LAX Account password was changed",
  twoFactorEnabled: "Two-step verification was turned on for your LAX Account",
  twoFactorDisabled: "Two-step verification was turned off for your LAX Account",
  backupCodesRegenerated: "New backup codes were created for your LAX Account",
  emailChanged: "The email address on your LAX Account was changed",
  phoneVerified: "A phone number was verified on your LAX Account",
  socialAccountLinked: `A sign-in method was linked to your ${SITE_NAME} account`,
  socialAccountUnlinked: `A sign-in method was disconnected from your ${SITE_NAME} account`,
  newDeviceLogin: "New sign-in to your LAX Account",
  passwordChangedElsewhere: `Your ${SITE_NAME} password was reset from another session`,
  passwordChangedSessionsNotRevoked: `Action needed: review active ${SITE_NAME} sessions`,
  kycResubmissionRequired: `Action needed on your ${SITE_NAME} identity verification`,
  submissionApproved: `Your ${SITE_NAME} submission was accepted`,
  submissionConverted: `Draft lot created for your ${SITE_NAME} submission`,
  submissionRejected: `Update on your ${SITE_NAME} submission`,
  submissionDraftReminder: `Reminder: finish your ${SITE_NAME} submission`,
} as const;
