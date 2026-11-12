import { formatDate, isSameLondonDay } from "@/lib/format-date";
import {
  type AccountPasskey,
  PASSKEY_LIMIT,
  PASSKEY_NAME_INPUT_MAX_LENGTH,
  isValidPasskeyName,
} from "@auction/identity-contracts/account";
import { describeRemainingMethods } from "./account-remaining-methods";

/** What the person is asked before a passkey is removed. */
export type PasskeyRemoveConfirmVm = {
  title: string;
  body: string;
  note: string;
  confirmLabel: string;
};

/** One passkey in the list, with everything its row, its rename dialog and its confirmation say. */
export type PasskeyItemVm = {
  id: string;
  name: string;
  /** Where it is kept: "Synced to your other devices", "This device only", "This security key only". */
  hint: string;
  /** "Tue 3 Nov 2026", in the one date style. */
  addedOn: string;
  /** "Last used today", "Last used Mon 2 Nov 2026" or "Not used yet". */
  lastUsed: string;
  /** Null when it can be removed; otherwise the sentence that says why not. */
  blockedReason: string | null;
  confirm: PasskeyRemoveConfirmVm;
};

/** The "Passkeys" row: what it invites, the Add button and the person's passkeys under it. */
export type PasskeysRowVm = {
  kind: "passkeys";
  title: "Passkeys";
  /** How many the person has; the row shows it beside the title once there is one. */
  count: number;
  /** What fits beside the button on a phone. */
  detail: string;
  /** What the row says from the small-tablet width up, in place of `detail`. */
  detailLong: string;
  addLabel: "Add a passkey";
  /** The button's label while the browser is being handed to the issuer. */
  busyLabel: "Opening…";
  /** Set at the limit: the Add button is disabled and this says why. */
  addBlockedReason: string | null;
  items: PasskeyItemVm[];
};

export const PASSKEY_LIMIT_REASON = `You have ${PASSKEY_LIMIT} passkeys, the most an account can have. Remove one to add another.`;

const INVITE = "Sign in with your face, fingerprint or screen lock.";

/** The one sentence a person is shown for a name that cannot be used; null when it can. */
export function passkeyNameProblem(raw: string): string | null {
  const name = raw.trim();
  if (name.length === 0) return "Enter a name for this passkey.";
  if (name.length > PASSKEY_NAME_INPUT_MAX_LENGTH) {
    return `Use ${PASSKEY_NAME_INPUT_MAX_LENGTH} characters or fewer.`;
  }
  return isValidPasskeyName(name) ? null : "Use a name without line breaks or hidden characters.";
}

function keptWhere(passkey: AccountPasskey): string {
  if (passkey.synced) return "Synced to your other devices";
  return passkey.kind === "security_key" ? "This security key only" : "This device only";
}

function lastUsedLabel(lastUsedAt: string | null, now: Date): string {
  if (!lastUsedAt) return "Not used yet";
  return isSameLondonDay(lastUsedAt, now)
    ? "Last used today"
    : `Last used ${formatDate(lastUsedAt)}`;
}

/** What is still there to sign in with when the passkey `removed` goes. */
type Standing = { hasPassword: boolean; providers: readonly string[] };

function buildItem(
  passkey: AccountPasskey,
  all: readonly AccountPasskey[],
  standing: Standing,
  blockedReason: string | null,
  now: Date,
): PasskeyItemVm {
  const left = describeRemainingMethods(
    { hasPassword: standing.hasPassword, passkeys: all.length - 1, providers: standing.providers },
    { otherPasskeys: true },
  );
  return {
    id: passkey.id,
    name: passkey.name,
    hint: keptWhere(passkey),
    addedOn: formatDate(passkey.createdAt),
    lastUsed: lastUsedLabel(passkey.lastUsedAt, now),
    blockedReason,
    confirm: {
      title: `Remove "${passkey.name}"?`,
      body: `You won't be able to sign in with this passkey any more. ${
        left ? `You'll still be able to sign in with ${left}. ` : ""
      }Every other device will be signed out of LAX Account, LAX Bid, LAX Shop and lax.art, and we'll email you to confirm. If you signed in a while ago, we'll ask you to sign in again first.`,
      note: "The passkey stays saved on the device until you delete it there too.",
      confirmLabel: "Remove passkey",
    },
  };
}

/**
 * The passkeys row. `isLastMethod` is the same rule the issuer applies: the only way left to sign
 * in cannot be removed, and the emailed link does not count. `onlyMethodReason` says it.
 */
export function buildPasskeysRow(input: {
  passkeys: readonly AccountPasskey[];
  hasPassword: boolean;
  /** Labels of the linked providers, such as "Google". */
  providers: readonly string[];
  isLastMethod: boolean;
  onlyMethodReason: string;
  now: Date;
}): PasskeysRowVm {
  const { passkeys, hasPassword, providers, isLastMethod, onlyMethodReason, now } = input;
  const standing = { hasPassword, providers };
  const items = passkeys.map((passkey) =>
    buildItem(passkey, passkeys, standing, isLastMethod ? onlyMethodReason : null, now),
  );
  const empty = passkeys.length === 0;
  return {
    kind: "passkeys",
    title: "Passkeys",
    count: passkeys.length,
    detail: INVITE,
    detailLong: empty
      ? `Sign in with your face, fingerprint or screen lock${
          hasPassword ? " instead of your password" : ""
        }. Safer, and nothing to remember.`
      : `${INVITE} No password to type.`,
    addLabel: "Add a passkey",
    busyLabel: "Opening…",
    addBlockedReason: passkeys.length >= PASSKEY_LIMIT ? PASSKEY_LIMIT_REASON : null,
    items,
  };
}
