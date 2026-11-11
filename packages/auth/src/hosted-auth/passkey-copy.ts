/**
 * Every sentence the hosted pages say about passkeys, in one place: the sign-in page, the
 * "Confirm it's you" page and the "Add a passkey" page. The wording never names a technology
 * the person does not know, and no sentence repeats text from a request or a device.
 */
export const PASSKEY_COPY = {
  signIn: {
    button: "Sign in with a passkey",
    busy: "Waiting for your passkey…",
    /** Quiet line when the device prompt was closed or timed out. */
    cancelled: "No passkey was used. Try again, or sign in another way.",
    notRecognised:
      "That passkey isn't linked to a LAX Account any more. Sign in another way, then add a new one in Security.",
    notVerified:
      "Your device didn't confirm it's you. Use a passkey that asks for your face, fingerprint or screen lock.",
    wrongPerson:
      "That passkey belongs to a different account from the one you are confirming. Use your own passkey, or sign in another way.",
    rateLimited: "Too many attempts. Wait a few minutes and try again.",
    unavailable: "We couldn't check your passkey just now. Try again, or sign in another way.",
  },
  confirm: {
    title: "Confirm it's you",
    lead: "Before you make this change, we need you to sign in again. This keeps your account safe if someone else is using your device.",
    usePasskey: "Use your passkey",
    notYou: "Not you?",
    notYouBusy: "Signing out…",
  },
  add: {
    title: "Add a passkey",
    lead: "A passkey lets you sign in to LAX with your face, fingerprint or screen lock. It's saved by your device or password manager, never by LAX, and it only works on LAX's real sign-in page.",
    syncNote:
      "If your passkeys sync (iCloud Keychain, Google Password Manager and most password managers), it will work on your other devices too.",
    create: "Create a passkey",
    waiting: "Waiting for your device…",
    cancel: "Cancel",
    backToAccount: "Back to LAX Account",
    cancelled: "No passkey was created. Try again when you're ready.",
    alreadyOnDevice:
      "This device already has a passkey for your LAX Account. You can use it to sign in.",
    notVerified:
      "Your device didn't confirm it's you, so the passkey wasn't saved. Use a device with a screen lock, or a password manager that asks for one.",
    unsupported:
      "This browser can't create passkeys. Use an up-to-date Safari, Chrome, Edge or Firefox, or add one from your phone.",
    limit: "You have 10 passkeys, the most an account can have. Remove one to add another.",
    rateLimited: "Too many attempts. Wait a few minutes and try again.",
    unavailable: "We couldn't save your passkey just now. Try again in a moment.",
    expiredTitle: "This link has expired",
    expired: "Go back to LAX Account and try again.",
    savedTitle: "Passkey added",
    savedLead: "Next time, choose your passkey when you sign in.",
    nameLabel: "Name",
    nameHint: "So you can tell your passkeys apart in Security.",
    nameRequired: "Enter a name for this passkey.",
    nameTooLong: "Use 40 characters or fewer.",
    save: "Save and go back to LAX Account",
    saving: "Saving…",
    renameFailed:
      "We couldn't save that name. Your passkey is saved; you can rename it in Security.",
    /** "It's synced to your Apple devices." and its siblings, by where the passkey is kept. */
    synced: {
      apple: "It's synced to your Apple devices.",
      google: "It's synced to your Google Password Manager.",
      manager: "It's synced by your password manager.",
      deviceOnly: "It works on this device only.",
    },
  },
  twoStepSetup: {
    orgOffer:
      "Your organisation asks for two-step verification. Add a passkey, or add a password and an authenticator app.",
    addPasskey: "Add a passkey in LAX Account",
  },
} as const;
