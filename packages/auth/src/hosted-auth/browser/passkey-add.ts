import { PASSKEY_COPY } from "../passkey-copy.js";
import { type CreatedPasskey, type PasskeyRuntime, createPasskey } from "./passkey-ceremony.js";
import { PASSKEY_NAME_LIMIT, isAcceptablePasskeyName } from "./passkey-name.js";
import type { PasskeyFailure } from "./passkey-outcome.js";

const COPY = PASSKEY_COPY.add;

/** How a refused or abandoned attempt is said: a quiet line, or the summary at the top. */
type FailureLine = { message: string; where: "quiet" | "summary" };

/** Every failure has a line; "expired" and "unsupported" also change what the page offers. */
export const ADD_FAILURE_LINES: Readonly<Record<PasskeyFailure, FailureLine>> = {
  cancelled: { message: COPY.cancelled, where: "quiet" },
  already_on_device: { message: COPY.alreadyOnDevice, where: "summary" },
  not_verified: { message: COPY.notVerified, where: "summary" },
  limit: { message: COPY.limit, where: "summary" },
  rate_limited: { message: COPY.rateLimited, where: "summary" },
  expired: { message: `${COPY.expiredTitle}. ${COPY.expired}`, where: "summary" },
  unsupported: { message: COPY.unsupported, where: "summary" },
  unavailable: { message: COPY.unavailable, where: "summary" },
  // Nothing here signs a person in, so these cannot arise; they read as "try again".
  not_recognised: { message: COPY.unavailable, where: "summary" },
  wrong_person: { message: COPY.unavailable, where: "summary" },
};

/**
 * Where the new passkey is kept, in words: the passkeys the issuer names itself get their own
 * line, other synced ones "your password manager", the rest only this device.
 */
export function syncNoteFor(passkey: Pick<CreatedPasskey, "name" | "synced" | "kind">): string {
  if (!passkey.synced || passkey.kind === "security_key") return COPY.synced.deviceOnly;
  if (passkey.name === "iCloud Keychain") return COPY.synced.apple;
  if (passkey.name === "Google Password Manager") return COPY.synced.google;
  return COPY.synced.manager;
}

/** What the name field says when the name is not one a passkey can have; null when it is fine. */
export function nameProblem(raw: string): string | null {
  const name = raw.trim();
  if (name.length === 0) return COPY.nameRequired;
  if (name.length > PASSKEY_NAME_LIMIT) return COPY.nameTooLong;
  return isAcceptablePasskeyName(name) ? null : COPY.nameRequired;
}

/** What the add page changes; the DOM glue implements it. */
export type PasskeyAddView = {
  busy(busy: boolean): void;
  quietNote(message: string | null): void;
  summary(message: string | null): void;
  /** The browser cannot make passkeys: the explanation replaces the button. */
  showUnsupported(): void;
  /** The passkey is made: the naming step, with the suggested name and where it is kept. */
  showSaved(passkey: CreatedPasskey, syncNote: string): void;
  nameError(message: string | null): void;
  saving(saving: boolean): void;
  /** Back to LAX Account's Security page, where the new passkey is listed. */
  leave(): void;
};

/** The page's one request of its own: giving the passkey the name the person chose. */
export type RenameCall = (passkeyId: string, name: string) => Promise<boolean>;

/**
 * The "Add a passkey" page: ready, waiting, saved, and every way it can stop. The passkey is
 * stored the moment the device answers, under the suggested name, so leaving the naming step
 * keeps it; "Save" only changes the name.
 */
export function createPasskeyAdd(input: {
  runtime: PasskeyRuntime;
  view: PasskeyAddView;
  rename: RenameCall;
}) {
  const { runtime, view } = input;
  let created: CreatedPasskey | null = null;

  return {
    start(): void {
      if (!runtime.supportsPasskeys()) view.showUnsupported();
    },

    async create(): Promise<void> {
      view.summary(null);
      view.quietNote(null);
      view.busy(true);
      const result = await createPasskey(runtime);
      view.busy(false);
      if (result.ok) {
        created = result.data;
        view.showSaved(result.data, syncNoteFor(result.data));
        return;
      }
      if (result.failure === "unsupported") view.showUnsupported();
      const line = ADD_FAILURE_LINES[result.failure];
      if (line.where === "quiet") view.quietNote(line.message);
      else view.summary(line.message);
    },

    async save(rawName: string): Promise<void> {
      if (!created) return;
      view.nameError(null);
      const problem = nameProblem(rawName);
      if (problem) {
        view.nameError(problem);
        return;
      }
      const name = rawName.trim();
      // Leaving the suggested name as it is needs no request.
      if (name === created.name) {
        view.leave();
        return;
      }
      view.saving(true);
      const saved = await input.rename(created.id, name).catch(() => false);
      view.saving(false);
      if (saved) {
        view.leave();
        return;
      }
      view.summary(COPY.renameFailed);
    },
  };
}
