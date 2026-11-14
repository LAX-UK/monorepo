import { runInNewContext } from "node:vm";
import { STEP_UP_COMPLETE_SCRIPT } from "@/lib/step-up-complete";
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { GET as GET_SCRIPT } from "./script/route";

function runScript(opener: unknown) {
  const close = vi.fn();
  runInNewContext(STEP_UP_COMPLETE_SCRIPT, {
    window: { location: { origin: "https://account.test" }, opener, close },
  });
  return close;
}

describe("GET /api/auth/step-up-complete", () => {
  it("is never cached and loads its script from Account itself, not inline", async () => {
    const response = GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain('<script src="/api/auth/step-up-complete/script" defer></script>');
    expect(html.match(/<script/g)).toHaveLength(1);
  });

  it("serves the script as JavaScript, never cached", () => {
    const response = GET_SCRIPT();
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("the completion script", () => {
  it("tells the opener only that it worked, addressed to Account's own origin, then closes", () => {
    const opener = { closed: false, postMessage: vi.fn() };
    const close = runScript(opener);
    expect(opener.postMessage).toHaveBeenCalledWith(
      { type: "lax-step-up", status: "ok" },
      "https://account.test",
    );
    expect(close).toHaveBeenCalled();
  });

  it("does nothing without an opener, so the page's link leads back", () => {
    expect(runScript(null)).not.toHaveBeenCalled();
    expect(runScript({ closed: true, postMessage: vi.fn() })).not.toHaveBeenCalled();
  });
});
