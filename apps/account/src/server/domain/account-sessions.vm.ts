import { formatRelativeAge, formatWeekdayDayMonth } from "@/lib/format-date";
import type { AccountSession } from "@auction/identity-contracts";
import {
  type DeviceKind,
  deviceProductNames,
  formatDeviceLabel,
} from "@auction/identity-contracts/account";
import { countryName } from "./account-addresses.vm";

export type SessionRowVm = {
  id: string;
  deviceLabel: string;
  deviceKind: DeviceKind;
  isCurrent: boolean;
  /** "Active now · United Kingdom" or "Last active 2 hours ago · France" */
  activity: string;
  /** "Signed in Mon 9 Nov · LAX Account, LAX Bid" */
  signedIn: string;
};

export type SessionsVm = {
  /** The device the person is using now; listed first and never offered for sign-out. */
  current: SessionRowVm | null;
  others: SessionRowVm[];
};

/** The device list's wording for an agent it cannot name; other screens keep "Unknown device". */
const UNKNOWN_BROWSER = "Unknown browser";

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

const MINUTE = 60_000;
const ACTIVE_NOW_WITHIN = 15 * MINUTE;
const RELATIVE_WITHIN = 7 * 24 * 60 * MINUTE;

/** "Active now" for a quarter of an hour, "2 hours ago" for a week, then the date. */
function describeActivity(lastActiveAt: Date, now: Date): string {
  const elapsed = now.getTime() - lastActiveAt.getTime();
  if (elapsed < ACTIVE_NOW_WITHIN) return "Active now";
  if (elapsed < RELATIVE_WITHIN) return `Last active ${formatRelativeAge(lastActiveAt, now)}`;
  return `Last active ${formatWeekdayDayMonth(lastActiveAt, now)}`;
}

/** "United Kingdom" for "GB", worded as in the address book; null when the runtime cannot name it. */
function deviceCountryName(code: string | null): string | null {
  if (!code) return null;
  const name = countryName(code);
  return name !== code ? name : null;
}

/** Parts the person has no value for are left out, never worded as unknown. */
function joinParts(parts: readonly (string | null | false)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(" · ");
}

function toRow(session: AccountSession, now: Date): SessionRowVm {
  const products = deviceProductNames(session.products);
  return {
    id: session.id,
    deviceLabel: formatDeviceLabel(session.userAgent, { unknown: UNKNOWN_BROWSER }),
    deviceKind: session.deviceKind,
    isCurrent: session.isCurrent,
    activity: joinParts([
      describeActivity(new Date(session.lastActiveAt), now),
      deviceCountryName(session.country),
    ]),
    signedIn: joinParts([
      `Signed in ${formatWeekdayDayMonth(session.createdAt, now)}`,
      products.length > 0 && products.join(", "),
    ]),
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

export type SignOutConfirmVm = {
  title: string;
  body: string;
  confirmLabel: string;
  /** The confirm button while the sign-out runs. */
  loadingLabel: string;
};

export function buildSignOutDeviceConfirm(
  row: Pick<SessionRowVm, "deviceLabel">,
): SignOutConfirmVm {
  return {
    title: `Sign out ${row.deviceLabel}?`,
    body: "That device will be signed out of LAX Account, LAX Bid, LAX Shop and lax.art. Whoever is using it will need to sign in again.",
    confirmLabel: "Sign out",
    loadingLabel: "Signing out…",
  };
}

export function buildSignOutOthersConfirm(count: number): SignOutConfirmVm {
  return {
    title: "Sign out everywhere else?",
    body: `${plural(count, "other device")} will be signed out of LAX Account, LAX Bid, LAX Shop and lax.art. You'll stay signed in on this device.`,
    confirmLabel: "Sign out everywhere else",
    loadingLabel: "Signing out…",
  };
}

export const NO_OTHER_DEVICES = "You're not signed in anywhere else.";

export function buildSignedOutDeviceMessage(row: Pick<SessionRowVm, "deviceLabel">): string {
  return `${row.deviceLabel} is signed out.`;
}

export function buildSignedOutOthersMessage(count: number): string {
  return count === 1 ? "Your other device is signed out." : "You're signed out everywhere else.";
}
