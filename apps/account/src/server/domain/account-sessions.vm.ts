import { formatRelativeAge } from "@/lib/format-date";
import type { AccountSession } from "@auction/identity-contracts";
import { formatDeviceLabel } from "@auction/identity-contracts/account";

export type SessionRowVm = {
  id: string;
  deviceLabel: string;
  /** "Last active 2 hours ago · Signed in 3 days ago with a passkey" */
  detail: string;
  isCurrent: boolean;
};

export type SessionsVm = {
  /** The device the person is using now; listed first and never offered for sign-out. */
  current: SessionRowVm | null;
  others: SessionRowVm[];
};

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** How a sign-in was made, in words that follow "Signed in 3 days ago with". */
const SIGNED_IN_WITH: Record<NonNullable<AccountSession["signedInWith"]>, string> = {
  password: "your password",
  passkey: "a passkey",
  provider: "Google or Apple",
};

function toRow(session: AccountSession, now: Date): SessionRowVm {
  const lastActive = formatRelativeAge(new Date(session.lastActiveAt), now);
  const signedIn = formatRelativeAge(new Date(session.createdAt), now);
  const activity = lastActive === "just now" ? "Active now" : `Last active ${lastActive}`;
  return {
    id: session.id,
    deviceLabel: formatDeviceLabel(session.userAgent),
    detail: `${activity} · Signed in ${signedIn}${
      session.signedInWith ? ` with ${SIGNED_IN_WITH[session.signedInWith]}` : ""
    }`,
    isCurrent: session.isCurrent,
  };
}

export function buildSessionsVm(sessions: readonly AccountSession[], now: Date): SessionsVm {
  const rows = [...sessions]
    .sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt))
    .map((session) => toRow(session, now));
  return {
    current: rows.find((row) => row.isCurrent) ?? null,
    others: rows.filter((row) => !row.isCurrent),
  };
}

/** How many other devices show before "Show N more devices". */
export const VISIBLE_OTHER_DEVICES = 4;

/** The other devices split into those shown at first and those behind "Show N more devices". */
export function splitOtherDevices(
  others: readonly SessionRowVm[],
  limit: number = VISIBLE_OTHER_DEVICES,
): { shown: SessionRowVm[]; hidden: SessionRowVm[] } {
  return { shown: others.slice(0, limit), hidden: others.slice(limit) };
}

export function showMoreDevicesLabel(count: number): string {
  return `Show ${count} more ${count === 1 ? "device" : "devices"}`;
}

export type SignOutConfirmVm = { title: string; body: string; confirmLabel: string };

export function buildSignOutDeviceConfirm(
  row: Pick<SessionRowVm, "deviceLabel">,
): SignOutConfirmVm {
  return {
    title: `Sign out ${row.deviceLabel}?`,
    body: "That device will be signed out of LAX Account, LAX Bid, LAX Shop and lax.art. Whoever is using it will need to sign in again.",
    confirmLabel: "Sign out",
  };
}

export function buildSignOutOthersConfirm(count: number): SignOutConfirmVm {
  return {
    title: "Sign out everywhere else?",
    body: `${plural(count, "other device")} will be signed out of LAX Account, LAX Bid, LAX Shop and lax.art. You'll stay signed in on this device.`,
    confirmLabel: "Sign out everywhere else",
  };
}
