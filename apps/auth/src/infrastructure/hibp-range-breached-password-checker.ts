import { createHash } from "node:crypto";
import type { BreachedPasswordCheckResult, BreachedPasswordChecker } from "@auction/auth";

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const TIMEOUT_MS = 2_000;

function sha1Upper(password: string): { prefix: string; suffix: string } {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

export class HibpRangeBreachedPasswordChecker implements BreachedPasswordChecker {
  async checkPassword(password: string): Promise<BreachedPasswordCheckResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const { prefix, suffix } = sha1Upper(password);
      const response = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
        signal: controller.signal,
        headers: { "Add-Padding": "true" },
      });
      if (!response.ok) return { status: "unknown" };
      const body = await response.text();
      const breached = body.split("\n").some((line) => {
        const [hashSuffix, countRaw] = line.split(":");
        if (hashSuffix?.trim() !== suffix) return false;
        const count = Number.parseInt(countRaw?.trim() ?? "0", 10);
        return count > 0;
      });
      return breached ? { status: "breached" } : { status: "clear" };
    } catch {
      return { status: "unknown" };
    } finally {
      clearTimeout(timer);
    }
  }
}
