export type ParsedUserAgent = {
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
};

function detectDeviceType(ua: string): ParsedUserAgent["deviceType"] {
  if (/iPad|Tablet|PlayBook/i.test(ua)) return "tablet";
  if (/Mobile|Android.*Mobile|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua))
    return "mobile";
  if (/Android|Windows NT|Macintosh|X11|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
}

function detectOs(ua: string): string {
  if (/Windows NT 10/i.test(ua)) return "Windows";
  if (/Windows NT 11/i.test(ua)) return "Windows";
  if (/Windows NT/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) {
    const m = /Mac OS X ([\d_]+)/.exec(ua);
    if (m?.[1]) return `macOS ${m[1].replaceAll("_", ".")}`;
    return "macOS";
  }
  if (/iPhone OS|CPU iPhone OS/.test(ua)) {
    const m = /OS ([\d_]+)/.exec(ua);
    return m?.[1] ? `iOS ${m[1].replaceAll("_", ".")}` : "iOS";
  }
  if (/Android ([\d.]+)/i.test(ua)) {
    const m = /Android ([\d.]+)/i.exec(ua);
    return m?.[1] ? `Android ${m[1]}` : "Android";
  }
  if (/CrOS/.test(ua)) return "Chrome OS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown OS";
}

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera\//.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/MSIE|Trident/.test(ua)) return "Internet Explorer";
  return "Unknown browser";
}

/** Best-effort UA parsing without extra dependencies. */
export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  if (userAgent == null || typeof userAgent !== "string") {
    return { browser: "Unknown browser", os: "Unknown OS", deviceType: "unknown" };
  }
  const ua = userAgent.trim();
  if (!ua) {
    return { browser: "Unknown browser", os: "Unknown OS", deviceType: "unknown" };
  }
  return {
    browser: detectBrowser(ua),
    os: detectOs(ua),
    deviceType: detectDeviceType(ua),
  };
}

export function formatDeviceLabel(parsed: ParsedUserAgent): string {
  if (parsed.browser === "Unknown browser" && parsed.os === "Unknown OS") return "Unknown device";
  if (parsed.browser === "Unknown browser") return parsed.os;
  if (parsed.os === "Unknown OS") return parsed.browser;
  return `${parsed.browser} on ${parsed.os}`;
}

/** ISP: swap parsers in tests without changing session card code. */
export interface IUserAgentParser {
  parse(userAgent: string | null | undefined): ParsedUserAgent;
}

export const defaultUserAgentParser: IUserAgentParser = {
  parse: (userAgent) => parseUserAgent(userAgent),
};
