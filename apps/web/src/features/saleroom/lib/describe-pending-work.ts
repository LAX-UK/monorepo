function count(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural} waiting`;
}

/** The line under a saleroom "needs attention" notice, in full words. */
export function describePendingWork(pending: {
  registrations: number;
  telephoneBookings: number;
}): string {
  const parts: string[] = [];
  if (pending.registrations > 0) {
    parts.push(count(pending.registrations, "registration", "registrations"));
  }
  if (pending.telephoneBookings > 0) {
    parts.push(count(pending.telephoneBookings, "telephone booking", "telephone bookings"));
  }
  return parts.join(", ") || "New work is waiting";
}
