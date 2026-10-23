import { type AccountSession, formatDeviceLabel } from "@auction/identity-contracts";

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

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** "just now", "5 minutes ago", "2 days ago", then a plain date once it stops being recent. */
export function formatSessionAge(then: Date, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - then.getTime());
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR) return `${plural(Math.floor(elapsed / MINUTE), "minute")} ago`;
  if (elapsed < DAY) return `${plural(Math.floor(elapsed / HOUR), "hour")} ago`;
  if (elapsed < 30 * DAY) return `${plural(Math.floor(elapsed / DAY), "day")} ago`;
  const date = then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `on ${date}`;
}

function toRow(session: AccountSession, now: Date): SessionRowVm {
  const lastActive = formatSessionAge(new Date(session.lastActiveAt), now);
  const signedIn = formatSessionAge(new Date(session.createdAt), now);
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
