/**
 * A short, human label for a browser user agent, such as "Chrome on macOS" or "Safari on iPhone".
 *
 * Operating-system versions are left out on purpose: browsers freeze or hide them (every recent
 * Mac reports 10.15.7), so printing one would be wrong more often than it helps. Falls back to
 * whichever half is known, then to "Unknown browser".
 */
export function formatDeviceLabel(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim() ?? "";
  const browser = detectBrowser(ua);
  const system = detectSystem(ua);
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown browser";
}

// Order matters: Edge, Opera and Samsung Internet also say "Chrome", and Chrome says "Safari".
function detectBrowser(ua: string): string | null {
  if (/Edg(e|A|iOS)?\//.test(ua)) return "Edge";
  if (/OPR\/|Opera\//.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return null;
}

// Order matters: iPhone and iPad user agents also say "like Mac OS X", Android says "Linux".
function detectSystem(ua: string): string | null {
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "macOS";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Linux|X11/.test(ua)) return "Linux";
  return null;
}

/** What kind of device a user agent comes from, for the icon beside it in the device list. */
export const DEVICE_KINDS = ["laptop", "phone", "tablet"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

/**
 * A phone, a tablet or (the neutral default, also for an unknown agent) a laptop or desktop.
 * Android tablets say "Android" without "Mobile".
 */
export function detectDeviceKind(userAgent: string | null | undefined): DeviceKind {
  const ua = userAgent?.trim() ?? "";
  if (/iPhone|iPod/.test(ua)) return "phone";
  if (/iPad/.test(ua)) return "tablet";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "phone" : "tablet";
  return "laptop";
}
