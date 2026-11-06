import { formatRelativeAge } from "@/lib/format-date";
import type { AccountSession } from "@auction/identity-contracts";
import { formatDeviceLabel } from "@auction/identity-contracts/account";

export type SessionRowVm = {
  id: string;
  deviceLabel: string;
  /** "Last active 2 hours ago · Signed in 3 days ago" */
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

function toRow(session: AccountSession, now: Date): SessionRowVm {
  const lastActive = formatRelativeAge(new Date(session.lastActiveAt), now);
  const signedIn = formatRelativeAge(new Date(session.createdAt), now);
  const activity = lastActive === "just now" ? "Active now" : `Last active ${lastActive}`;
  return {
    id: session.id,
    deviceLabel: formatDeviceLabel(session.userAgent),
    detail: `${activity} · Signed in ${signedIn}`,
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
