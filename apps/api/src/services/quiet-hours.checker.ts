/** SRP: quiet-hours window for push suppression. */
export interface IQuietHoursChecker {
  isQuietTime(quietStart: string | null, quietEnd: string | null): boolean;
}

export class QuietHoursChecker implements IQuietHoursChecker {
  isQuietTime(quietStart: string | null, quietEnd: string | null): boolean {
    if (!quietStart || !quietEnd) return false;
    const now = new Date();
    const [startH, startM] = quietStart.split(":").map(Number);
    const [endH, endM] = quietEnd.split(":").map(Number);
    if (!Number.isFinite(startH) || !Number.isFinite(endH)) return false;
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const startMinutes = (startH ?? 0) * 60 + (startM ?? 0);
    const endMinutes = (endH ?? 0) * 60 + (endM ?? 0);
    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    }
    return nowMinutes >= startMinutes || nowMinutes < endMinutes;
  }
}
